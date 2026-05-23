import { Queue } from 'bullmq';
import { prisma } from '@shwp-rec/db';
import { Prisma } from '@prisma/client';
import { REDIS_CONFIG, RECORD_QUEUE_NAME, PROCESS_QUEUE_NAME, RecordStreamJobData } from '@shwp-rec/queue';
import { createLogger } from '@shwp-rec/config';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

const log = createLogger('service-scheduler');

const SCAN_INTERVAL_MS = 60000;
let scanRunning = false;

const recordQueue = new Queue<RecordStreamJobData>(RECORD_QUEUE_NAME, {
  connection: REDIS_CONFIG,
});

async function runScan() {
  if (scanRunning) {
    log.warn('Previous scan still running, skipping');
    return;
  }
  scanRunning = true;
  log.info('Starting scan');

  let browser;
  try {
    log.info('Loading homepage');
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto('https://showup.tv', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('script#__NEXT_DATA__', { timeout: 15000 }).catch(() => {});
    const html = await page.content();
    await browser.close();
    browser = undefined;

    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (!match) {
      log.error('Could not find __NEXT_DATA__ in homepage');
      return;
    }

    const data = JSON.parse(match[1]);
    const list = data?.props?.pageProps?.homeListData?.list || [];

    // Filter for online females
    const females = list.filter((item: any) => item.host?.gender === 'FEMALE');
    log.info({ count: females.length }, 'Found online models');

    // Find models currently being recorded
    const activeStreams = await prisma.stream.findMany({
      where: { status: 'RECORDING' },
      include: { model: true },
    });

    const activeUsernames = new Set(
      activeStreams.map((s: { model: { username: string } }) => s.model.username.toLowerCase())
    );

    let enqueuedCount = 0;

    for (const item of females) {
      const uid = item.host.id;
      const username = item.host.username;
      const aliasStreamKey = item.broadcast?.aliasStreamKey || null;

      if (!activeUsernames.has(username.toLowerCase())) {
        let streamId: string;

        try {
          const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const model = await tx.model.upsert({
              where: { username },
              update: {},
              create: { username },
            });
            const stream = await tx.stream.create({
              data: { modelId: model.id, status: 'RECORDING' },
            });
            return { model, stream };
          });

          streamId = result.stream.id;
        } catch (dbErr) {
          log.error({ username, err: dbErr }, 'DB transaction failed, skipping');
          continue;
        }

        try {
          await recordQueue.add('record', {
            uid: String(uid),
            username: String(username),
            aliasStreamKey,
            streamId,
          }, {
            jobId: streamId,
            removeOnComplete: true,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          });
          log.info({ username }, 'Enqueued recording');
          enqueuedCount++;
        } catch (queueErr) {
          log.error({ username, streamId, err: queueErr }, 'Queue add failed, marking stream FAILED');
          await prisma.stream.update({ where: { id: streamId }, data: { status: 'FAILED' } });
        }
      }
    }

    log.info({ enqueuedCount }, 'Scan complete');

  } catch (error) {
    log.error({ err: error }, 'Error during scan');
  } finally {
    if (browser) await browser.close().catch(() => {});
    scanRunning = false;
  }
}

async function sweepStaleStreams() {
  const now = new Date();

  const staleRecording = await prisma.stream.updateMany({
    where: {
      status: 'RECORDING',
      startTime: { lt: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
    },
    data: { status: 'FAILED' },
  });

  const staleProcessing = await prisma.stream.updateMany({
    where: {
      status: 'PROCESSING',
      updatedAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) },
    },
    data: { status: 'FAILED' },
  });

  if (staleRecording.count > 0 || staleProcessing.count > 0) {
    log.warn(
      { staleRecording: staleRecording.count, staleProcessing: staleProcessing.count },
      'Swept stale streams'
    );
  }
}

import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import * as promClient from 'prom-client';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function registerMetrics(recordQ: Queue, processQ: Queue) {
  promClient.collectDefaultMetrics();

  const queueDepthGauge = new promClient.Gauge({
    name: 'bullmq_queue_depth',
    help: 'Number of waiting jobs in a BullMQ queue',
    labelNames: ['queue'] as const,
  });

  const activeJobsGauge = new promClient.Gauge({
    name: 'bullmq_active_jobs',
    help: 'Number of active (processing) jobs in a BullMQ queue',
    labelNames: ['queue'] as const,
  });

  const failedJobsGauge = new promClient.Gauge({
    name: 'bullmq_failed_jobs',
    help: 'Number of failed jobs in a BullMQ queue',
    labelNames: ['queue'] as const,
  });

  async function collect() {
    for (const [name, queue] of [[RECORD_QUEUE_NAME, recordQ], [PROCESS_QUEUE_NAME, processQ]] as const) {
      const counts = await queue.getJobCounts('waiting', 'active', 'failed').catch(() => ({ waiting: 0, active: 0, failed: 0 }));
      queueDepthGauge.set({ queue: name }, counts.waiting ?? 0);
      activeJobsGauge.set({ queue: name }, counts.active ?? 0);
      failedJobsGauge.set({ queue: name }, counts.failed ?? 0);
    }
  }

  return { collect };
}

async function start() {
  log.info({ redisHost: REDIS_CONFIG.host, redisPort: REDIS_CONFIG.port }, 'Service started');

  const processQueue = new Queue(PROCESS_QUEUE_NAME, { connection: REDIS_CONFIG });
  const { collect } = registerMetrics(recordQueue, processQueue);

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: [new BullMQAdapter(recordQueue), new BullMQAdapter(processQueue)],
    serverAdapter: serverAdapter,
  });

  const app = express();
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });
  app.get('/metrics', async (_req, res) => {
    await collect();
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  });
  app.use('/admin/queues', serverAdapter.getRouter());
  app.listen(3001, () => {
    log.info({ url: 'http://localhost:3001/admin/queues' }, 'Bull Board UI running');
  });

  // Initial scan and sweep
  await runScan();
  await sweepStaleStreams().catch(err => log.error({ err }, 'Initial sweep error'));

  // Scan loop
  setInterval(() => {
    runScan().catch(err => log.error({ err }, 'Unhandled scan error'));
  }, SCAN_INTERVAL_MS);

  // Stale stream sweeper loop
  setInterval(() => {
    sweepStaleStreams().catch(err => log.error({ err }, 'Sweep error'));
  }, SWEEP_INTERVAL_MS);

  process.on('SIGTERM', async () => {
    log.info('SIGTERM received, closing');
    await recordQueue.close();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    log.info('SIGINT received, closing');
    await recordQueue.close();
    process.exit(0);
  });
}

start().catch(err => {
  log.fatal({ err }, 'Failed to start service');
  process.exit(1);
});

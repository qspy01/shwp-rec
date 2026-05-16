import { Queue } from 'bullmq';
import { prisma } from '@shwp-rec/db';
import { REDIS_CONFIG, RECORD_QUEUE_NAME, PROCESS_QUEUE_NAME, RecordStreamJobData } from '@shwp-rec/queue';
import { createLogger } from '@shwp-rec/config';

const log = createLogger('service-scheduler');

const SCAN_INTERVAL_MS = 60000; // 1 minute

const recordQueue = new Queue<RecordStreamJobData>(RECORD_QUEUE_NAME, {
  connection: REDIS_CONFIG,
});

async function runScan() {
  log.info('Starting scan');

  try {
    log.info('Loading homepage');
    const res = await fetch('https://showup.tv', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
    });
    const html = await res.text();

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

    const activeUsernames = new Set(activeStreams.map(s => String((s.model as any).username).toLowerCase()));

    let enqueuedCount = 0;

    for (const item of females) {
      const uid = item.host.id;
      const username = item.host.username;
      const aliasStreamKey = item.broadcast?.aliasStreamKey || null;

      if (!activeUsernames.has(username.toLowerCase())) {
        // Find or create model in DB
        const model = await prisma.model.upsert({
          where: { username },
          update: {},
          create: { username },
        });

        // Create new stream record
        const stream = await prisma.stream.create({
          data: {
            modelId: String((model as any).id),
            status: 'RECORDING',
          },
        });

        // Enqueue job
        await recordQueue.add('record', {
          uid: String(uid),
          username: String(username),
          aliasStreamKey,
          streamId: String((stream as any).id),
        }, {
          jobId: String((stream as any).id), // Ensure idempotency
          removeOnComplete: true,
        });

        log.info({ username }, 'Enqueued recording');
        enqueuedCount++;
      }
    }

    log.info({ enqueuedCount }, 'Scan complete');

  } catch (error) {
    log.error({ err: error }, 'Error during scan');
  }
}

import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

async function start() {
  log.info({ redisHost: REDIS_CONFIG.host, redisPort: REDIS_CONFIG.port }, 'Service started');

  const processQueue = new Queue(PROCESS_QUEUE_NAME, { connection: REDIS_CONFIG });

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: [new BullMQAdapter(recordQueue), new BullMQAdapter(processQueue)],
    serverAdapter: serverAdapter,
  });

  const app = express();
  app.use('/admin/queues', serverAdapter.getRouter());
  app.listen(3001, () => {
    log.info({ url: 'http://localhost:3001/admin/queues' }, 'Bull Board UI running');
  });

  // Initial scan
  await runScan();

  // Schedule loop
  setInterval(() => {
    runScan().catch(err => log.error({ err }, 'Unhandled scan error'));
  }, SCAN_INTERVAL_MS);

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

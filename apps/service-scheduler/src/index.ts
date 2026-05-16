import { Queue } from 'bullmq';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { prisma } from '@shwp-rec/db';
import { REDIS_CONFIG, RECORD_QUEUE_NAME, PROCESS_QUEUE_NAME, RecordStreamJobData } from '@shwp-rec/queue';

chromium.use(stealth());

const SCAN_INTERVAL_MS = 60000; // 1 minute

const recordQueue = new Queue<RecordStreamJobData>(RECORD_QUEUE_NAME, {
  connection: REDIS_CONFIG,
});

async function runScan() {
  console.log('[Scheduler] Starting scan...');
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage();
    console.log('[Scheduler] Loading homepage...');
    await page.goto('https://showup.tv', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const html = await page.content();
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (!match) {
      console.error('[Scheduler] Could not find __NEXT_DATA__ in homepage');
      return;
    }

    const data = JSON.parse(match[1]);
    const list = data?.props?.pageProps?.homeListData?.list || [];
    
    // Filter for online females
    const females = list.filter((item: any) => item.host?.gender === 'FEMALE');
    console.log(`[Scheduler] Found ${females.length} online females on homepage.`);

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

        console.log(`[Scheduler] Enqueued recording for ${username}`);
        enqueuedCount++;
      }
    }

    console.log(`[Scheduler] Scan complete. Enqueued ${enqueuedCount} new streams.`);

  } catch (error) {
    console.error('[Scheduler] Error during scan:', error);
  } finally {
    await browser.close();
  }
}

import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

async function start() {
  console.log(`[Scheduler] Service started. Redis host: ${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`);
  
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
    console.log('[Scheduler] Bull Board UI running on http://localhost:3001/admin/queues');
  });

  // Initial scan
  await runScan();

  // Schedule loop
  setInterval(() => {
    runScan().catch(console.error);
  }, SCAN_INTERVAL_MS);
}

start().catch(console.error);

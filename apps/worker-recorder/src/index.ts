import { Worker, Job, Queue } from 'bullmq';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { prisma } from '@shwp-rec/db';
import { REDIS_CONFIG, RECORD_QUEUE_NAME, PROCESS_QUEUE_NAME, RecordStreamJobData, ProcessMediaJobData } from '@shwp-rec/queue';
import { env } from '@shwp-rec/config';
import * as fs from 'fs';
import * as path from 'path';

chromium.use(stealth());

const CAPTURE_DIR = '/tmp/shwp/captures';
if (!fs.existsSync(CAPTURE_DIR)) {
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
}

const processQueue = new Queue<ProcessMediaJobData>(PROCESS_QUEUE_NAME, {
  connection: REDIS_CONFIG,
});

async function processRecordJob(job: Job<RecordStreamJobData>) {
  const { username, streamId } = job.data;
  console.log(`[Recorder] Starting job for ${username} (Stream: ${streamId})`);

  const rawFilePath = path.join(CAPTURE_DIR, `${streamId}.raw.mp4`);
  const fileStream = fs.createWriteStream(rawFilePath);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let lastChunkTime = Date.now();
  let streamEnded = false;
  let byteCount = 0;

  page.on('websocket', ws => {
    if (!ws.url().includes('storm')) return;
    console.log(`[Recorder] Connected to Storm WS for ${username}`);

    ws.on('framereceived', frame => {
      const payload = frame.payload;
      if (typeof payload === 'string') return; // Ignore text frames

      const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
      fileStream.write(buf);
      lastChunkTime = Date.now();
      byteCount += buf.length;
    });
  });

  try {
    await page.goto(`https://showup.tv/${encodeURIComponent(username)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    // Dismiss the 18+ warning if present
    try {
      await page.click('button:has-text("Wchodzę")', { timeout: 3000 });
    } catch (_) { }

    // Wait until stream finishes or timeouts (90 seconds of no data)
    await new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => {
        if (Date.now() - lastChunkTime > 90000) {
          console.log(`[Recorder] No data for 90s. Stream ended for ${username}`);
          streamEnded = true;
          clearInterval(interval);
          resolve();
        }
      }, 5000);

      // Handle page crash/close
      page.on('close', () => {
        if (!streamEnded) {
          console.warn(`[Recorder] Page closed unexpectedly for ${username}`);
          clearInterval(interval);
          reject(new Error('Page closed'));
        }
      });
    });

  } catch (error) {
    console.error(`[Recorder] Error recording ${username}:`, error);
    throw error;
  } finally {
    fileStream.end();
    await browser.close();
  }

  // Finalize
  console.log(`[Recorder] Finalized ${username}. Saved ${byteCount} bytes.`);
  
  if (byteCount > 1024 * 1024) { // Only process if > 1MB
    // Update DB
    await prisma.stream.update({
      where: { id: streamId },
      data: { 
        status: 'PROCESSING',
        endTime: new Date(),
      },
    });

    // Enqueue process job
    await processQueue.add('process', {
      streamId,
      modelUsername: username,
    }, {
      jobId: streamId,
      removeOnComplete: true,
    });
    console.log(`[Recorder] Enqueued process job for ${username}`);
  } else {
    // File too small, likely offline
    fs.unlinkSync(rawFilePath);
    await prisma.stream.update({
      where: { id: streamId },
      data: { status: 'FAILED' },
    });
    console.log(`[Recorder] Recording too small, discarded for ${username}`);
  }
}

const worker = new Worker<RecordStreamJobData>(
  RECORD_QUEUE_NAME,
  processRecordJob,
  {
    connection: REDIS_CONFIG,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

worker.on('completed', job => {
  console.log(`[Recorder] Job completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[Recorder] Job failed: ${job?.id} - ${err.message}`);
});

async function shutdown(signal: string) {
  console.log(`[Recorder] Received ${signal}. Shutting down gracefully...`);
  await worker.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log(`[Recorder] Worker started. Listening on queue: ${RECORD_QUEUE_NAME}`);

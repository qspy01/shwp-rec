import { Worker, Job, Queue } from 'bullmq';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { prisma } from '@shwp-rec/db';
import { REDIS_CONFIG, RECORD_QUEUE_NAME, PROCESS_QUEUE_NAME, RecordStreamJobData, ProcessMediaJobData } from '@shwp-rec/queue';
import { env, createLogger } from '@shwp-rec/config';
import * as fs from 'fs';
import * as path from 'path';

const log = createLogger('worker-recorder');

chromium.use(stealth());

const CAPTURE_DIR = env.CAPTURE_DIR;
if (!fs.existsSync(CAPTURE_DIR)) {
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
}

const processQueue = new Queue<ProcessMediaJobData>(PROCESS_QUEUE_NAME, {
  connection: REDIS_CONFIG,
});

async function processRecordJob(job: Job<RecordStreamJobData>) {
  const { username, streamId } = job.data;
  log.info({ username, streamId }, 'Starting job');

  const rawFilePath = path.join(CAPTURE_DIR, `${streamId}.raw.mp4`);
  const fileStream = fs.createWriteStream(rawFilePath);

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  let lastChunkTime = Date.now();
  let streamEnded = false;
  let byteCount = 0;

  page.on('websocket', ws => {
    if (!ws.url().includes('storm')) return;
    log.info({ username, streamId }, 'Connected to Storm WS');

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
          log.info({ username, streamId }, 'No data for 90s, stream ended');
          streamEnded = true;
          clearInterval(interval);
          resolve();
        }
      }, 5000);

      // Handle page crash/close
      page.on('close', () => {
        if (!streamEnded) {
          log.warn({ username, streamId }, 'Page closed unexpectedly');
          clearInterval(interval);
          reject(new Error('Page closed'));
        }
      });
    });

  } catch (error) {
    log.error({ username, streamId, err: error }, 'Error recording');
    throw error;
  } finally {
    fileStream.end();
    await browser.close();
  }

  log.info({ username, streamId, byteCount }, 'Recording finalized');

  if (byteCount > 1024 * 1024) { // Only process if > 1MB
    await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: 'PROCESSING',
        endTime: new Date(),
      },
    });

    await processQueue.add('process', {
      streamId,
      modelUsername: username,
    }, {
      jobId: streamId,
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    log.info({ username, streamId }, 'Enqueued process job');
  } else {
    // File too small, likely offline
    fs.unlinkSync(rawFilePath);
    await prisma.stream.update({
      where: { id: streamId },
      data: { status: 'FAILED' },
    });
    log.info({ username, streamId, byteCount }, 'Recording too small, discarded');
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
  log.info({ jobId: job.id }, 'Job completed');
});

worker.on('failed', (job, err) => {
  log.error({ jobId: job?.id, err }, 'Job failed');
});

async function shutdown(signal: string) {
  log.info({ signal }, 'Shutting down gracefully');
  await worker.close();
  await processQueue.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

log.info({ queue: RECORD_QUEUE_NAME }, 'Worker started');

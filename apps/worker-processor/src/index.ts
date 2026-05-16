import { Worker, Job } from 'bullmq';
import { prisma } from '@shwp-rec/db';
import { REDIS_CONFIG, PROCESS_QUEUE_NAME, ProcessMediaJobData } from '@shwp-rec/queue';
import { env, createLogger } from '@shwp-rec/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';

const log = createLogger('worker-processor');

const s3Client = new S3Client({
  region: 'us-east-1', // MinIO requires a region, even if dummy
  endpoint: env.MINIO_ENDPOINT,
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = env.MINIO_BUCKET;
const CAPTURE_DIR = env.CAPTURE_DIR;

async function uploadToMinIO(filePath: string, s3Key: string, contentType: string) {
  const fileStream = fs.createReadStream(filePath);
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: contentType,
  }));
}

function processVideo(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-movflags +faststart',
        '-c:v copy',
        '-c:a aac',
        '-b:a 128k',
      ])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

function extractThumbnail(inputPath: string, outputDir: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['00:00:10'], // Capture at 10s
        filename: filename,
        folder: outputDir,
        size: '1280x720',
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

function getMetadata(filePath: string): Promise<{ duration: number; resolution: string | null }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const stream = metadata.streams.find(s => s.codec_type === 'video');
      resolve({
        duration: Math.round(metadata.format.duration || 0),
        resolution: stream ? `${stream.width}x${stream.height}` : null,
      });
    });
  });
}

async function processMediaJob(job: Job<ProcessMediaJobData>) {
  const { streamId, modelUsername } = job.data;
  const rawFilePath = path.join(CAPTURE_DIR, `${streamId}.raw.mp4`);
  log.info({ streamId, modelUsername }, 'Processing stream');

  if (!fs.existsSync(rawFilePath)) {
    throw new Error(`Raw file not found: ${rawFilePath}`);
  }

  const outFilename = `${streamId}.mp4`;
  const thumbFilename = `${streamId}.jpg`;
  const outFilePath = path.join(CAPTURE_DIR, outFilename);

  try {
    log.info({ streamId }, 'Converting video');
    await processVideo(rawFilePath, outFilePath);

    log.info({ streamId }, 'Extracting thumbnail');
    await extractThumbnail(outFilePath, CAPTURE_DIR, thumbFilename);

    log.info({ streamId }, 'Extracting metadata');
    const meta = await getMetadata(outFilePath);

    const s3VideoKey = `${modelUsername}/${outFilename}`;
    const s3ThumbKey = `${modelUsername}/${thumbFilename}`;

    log.info({ streamId, s3VideoKey }, 'Uploading to MinIO');
    await uploadToMinIO(outFilePath, s3VideoKey, 'video/mp4');
    await uploadToMinIO(path.join(CAPTURE_DIR, thumbFilename), s3ThumbKey, 'image/jpeg');

    await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: 'PUBLISHED',
        duration: meta.duration,
        resolution: meta.resolution,
        s3Key: s3VideoKey,
        thumbnailKey: s3ThumbKey,
      },
    });

    log.info({ streamId }, 'Stream published successfully');

  } catch (error) {
    log.error({ streamId, err: error }, 'Error processing stream');

    await prisma.stream.update({
      where: { id: streamId },
      data: { status: 'FAILED' },
    });

    throw error;
  } finally {
    const toDelete = [rawFilePath, outFilePath, path.join(CAPTURE_DIR, thumbFilename)];
    toDelete.forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  }
}

const worker = new Worker<ProcessMediaJobData>(
  PROCESS_QUEUE_NAME,
  processMediaJob,
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
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

log.info({ queue: PROCESS_QUEUE_NAME }, 'Worker started');

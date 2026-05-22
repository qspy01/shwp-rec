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
  region: 'us-east-1',
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
      .on('error', (err: Error) => reject(err));
  });
}

function generateHls(inputPath: string, hlsDir: string, streamId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const manifestPath = path.join(hlsDir, `${streamId}.m3u8`);
    const segmentPattern = path.join(hlsDir, `${streamId}_%04d.ts`);
    ffmpeg(inputPath)
      .outputOptions([
        '-codec copy',
        '-start_number 0',
        '-hls_time 10',
        '-hls_list_size 0',
        '-hls_flags independent_segments',
        `-hls_segment_filename ${segmentPattern}`,
        '-f hls',
      ])
      .save(manifestPath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err));
  });
}

function extractThumbnail(inputPath: string, outputDir: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['00:00:10'],
        filename: filename,
        folder: outputDir,
        size: '1280x720',
      })
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err));
  });
}

function getMetadata(filePath: string): Promise<{ duration: number; resolution: string | null }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      resolve({
        duration: Math.round(metadata.format.duration || 0),
        resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : null,
      });
    });
  });
}

function removeDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) return;
  for (const f of fs.readdirSync(dirPath)) {
    fs.unlinkSync(path.join(dirPath, f));
  }
  fs.rmdirSync(dirPath);
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
  const hlsDir = path.join(CAPTURE_DIR, `${streamId}_hls`);

  try {
    // Step 1: Mux raw capture to MP4 (faststart + AAC audio)
    log.info({ streamId }, 'Converting video');
    await processVideo(rawFilePath, outFilePath);

    // Step 2: Extract thumbnail at 10s
    log.info({ streamId }, 'Extracting thumbnail');
    await extractThumbnail(outFilePath, CAPTURE_DIR, thumbFilename);

    // Step 3: Probe metadata
    log.info({ streamId }, 'Extracting metadata');
    const meta = await getMetadata(outFilePath);

    // Step 4: Generate HLS segments from the muxed MP4
    log.info({ streamId }, 'Generating HLS segments');
    fs.mkdirSync(hlsDir, { recursive: true });
    await generateHls(outFilePath, hlsDir, streamId);

    // Step 5: Upload MP4, thumbnail, and all HLS files to MinIO
    const s3Prefix = `${modelUsername}/${streamId}`;
    const s3VideoKey = `${s3Prefix}.mp4`;
    const s3ThumbKey = `${s3Prefix}.jpg`;
    const hlsS3Prefix = s3Prefix;
    const hlsManifestKey = `${hlsS3Prefix}/${streamId}.m3u8`;

    log.info({ streamId, s3VideoKey }, 'Uploading MP4 and thumbnail');
    await uploadToMinIO(outFilePath, s3VideoKey, 'video/mp4');
    await uploadToMinIO(path.join(CAPTURE_DIR, thumbFilename), s3ThumbKey, 'image/jpeg');

    log.info({ streamId, hlsManifestKey }, 'Uploading HLS segments');
    const hlsFiles = fs.readdirSync(hlsDir).sort();
    for (const file of hlsFiles) {
      const contentType = file.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'video/MP2T';
      await uploadToMinIO(path.join(hlsDir, file), `${hlsS3Prefix}/${file}`, contentType);
    }

    // Step 6: Mark stream as published
    await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: 'PUBLISHED',
        duration: meta.duration,
        resolution: meta.resolution,
        s3Key: s3VideoKey,
        thumbnailKey: s3ThumbKey,
        hlsKey: hlsManifestKey,
      },
    });

    log.info({ streamId, hlsSegments: hlsFiles.length }, 'Stream published successfully');

  } catch (error) {
    log.error({ streamId, err: error }, 'Error processing stream');
    await prisma.stream.update({
      where: { id: streamId },
      data: { status: 'FAILED' },
    });
    throw error;
  } finally {
    // Clean up all local temp files
    const filesToDelete = [rawFilePath, outFilePath, path.join(CAPTURE_DIR, thumbFilename)];
    for (const f of filesToDelete) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    removeDir(hlsDir);
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

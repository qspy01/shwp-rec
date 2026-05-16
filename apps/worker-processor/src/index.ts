import { Worker, Job } from 'bullmq';
import { prisma } from '@shwp-rec/db';
import { REDIS_CONFIG, PROCESS_QUEUE_NAME, ProcessMediaJobData } from '@shwp-rec/queue';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: 'us-east-1', // MinIO requires a region, even if dummy
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9005',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'password123',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'vods';

async function uploadToMinIO(filePath: string, s3Key: string, contentType: string) {
  const fileStream = fs.createReadStream(filePath);
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: contentType,
  }));
}

function processVideo(inputPath: string, outputPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-movflags +faststart',
        '-c:v copy',
        '-c:a aac',
        '-b:a 128k'
      ])
      .save(outputPath)
      .on('end', () => resolve(true))
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
        size: '1280x720'
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

function getMetadata(filePath: string): Promise<any> {
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
  const { streamId, rawFilePath, modelUsername } = job.data;
  console.log(`[Processor] Processing stream ${streamId} for ${modelUsername}`);

  if (!fs.existsSync(rawFilePath)) {
    throw new Error(`Raw file not found: ${rawFilePath}`);
  }

  const dir = path.dirname(rawFilePath);
  const outFilename = `${streamId}.mp4`;
  const thumbFilename = `${streamId}.jpg`;
  const outFilePath = path.join(dir, outFilename);
  
  try {
    // 1. Mux and convert audio
    console.log(`[Processor] Converting video...`);
    await processVideo(rawFilePath, outFilePath);

    // 2. Extract Thumbnail
    console.log(`[Processor] Extracting thumbnail...`);
    await extractThumbnail(outFilePath, dir, thumbFilename);

    // 3. Extract Metadata
    console.log(`[Processor] Extracting metadata...`);
    const meta = await getMetadata(outFilePath);

    // 4. Upload to MinIO
    const s3VideoKey = `${modelUsername}/${outFilename}`;
    const s3ThumbKey = `${modelUsername}/${thumbFilename}`;
    
    console.log(`[Processor] Uploading to MinIO...`);
    await uploadToMinIO(outFilePath, s3VideoKey, 'video/mp4');
    await uploadToMinIO(path.join(dir, thumbFilename), s3ThumbKey, 'image/jpeg');

    // 5. Update DB
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

    console.log(`[Processor] Stream ${streamId} published successfully!`);

  } catch (error) {
    console.error(`[Processor] Error processing ${streamId}:`, error);
    
    await prisma.stream.update({
      where: { id: streamId },
      data: { status: 'FAILED' },
    });
    
    throw error;
  } finally {
    // Cleanup local files
    const toDelete = [rawFilePath, outFilePath, path.join(dir, thumbFilename)];
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
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
  }
);

worker.on('completed', job => {
  console.log(`[Processor] Job completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[Processor] Job failed: ${job?.id} - ${err.message}`);
});

console.log(`[Processor] Worker started. Listening on queue: ${PROCESS_QUEUE_NAME}`);

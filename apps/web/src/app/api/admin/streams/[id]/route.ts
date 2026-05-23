import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@shwp-rec/db';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type ObjectIdentifier,
} from '@aws-sdk/client-s3';

// Singleton — same pattern as media proxy
let _s3: S3Client | undefined;
function getS3Client(): S3Client {
  if (_s3) return _s3;
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKeyId = process.env.MINIO_ACCESS_KEY;
  const secretAccessKey = process.env.MINIO_SECRET_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY must be set');
  }
  _s3 = new S3Client({
    region: 'us-east-1',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return _s3;
}

async function deleteStreamFromStorage(bucket: string, prefix: string): Promise<void> {
  const s3 = getS3Client();

  // List all objects under this stream prefix (mp4, jpg, m3u8, ts segments)
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const objects: ObjectIdentifier[] = (listed.Contents ?? []).map((obj) => ({ Key: obj.Key! }));

  if (objects.length === 0) return;

  // Delete in one batch (streams have < 1000 objects)
  await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects, Quiet: true } }));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Middleware already verified ADMIN role and set x-user-role header
  const { id } = await params;

  const stream = await prisma.stream.findUnique({
    where: { id },
    include: { model: true },
  });
  if (!stream) {
    return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  }

  // Delete all S3 objects for this stream
  const bucket = process.env.MINIO_BUCKET ?? 'vods';
  const prefix = `${stream.model.username}/${stream.id}`;
  try {
    await deleteStreamFromStorage(bucket, prefix);
  } catch (err) {
    // Log but don't block DB deletion — storage may already be missing
    console.error({ streamId: id, err }, 'Failed to delete stream from storage');
  }

  await prisma.stream.delete({ where: { id } });

  return NextResponse.json({ deleted: id });
}

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9005',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'password123',
  },
  forcePathStyle: true,
});

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const key = (await params).path.join('/');
  try {
    const data = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.MINIO_BUCKET || 'vods',
      Key: key,
    }));
    
    return new NextResponse(data.Body as any, {
      headers: {
        'Content-Type': data.ContentType || 'application/octet-stream',
      },
    });
  } catch (err) {
    return new NextResponse('Not found', { status: 404 });
  }
}

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';

const SAFE_KEY_RE = /^[a-zA-Z0-9_\-/. ]+$/;

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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function inferContentType(key: string): string {
  if (key.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (key.endsWith('.ts')) return 'video/MP2T';
  if (key.endsWith('.mp4')) return 'video/mp4';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  if (!await checkRateLimit(`media:${ip}`, 300, 60_000)) {
    return new NextResponse('Too Many Requests', { status: 429, headers: CORS_HEADERS });
  }

  const segments = (await params).path;
  const key = segments.join('/');

  if (!SAFE_KEY_RE.test(key) || key.includes('..')) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const range = req.headers.get('range');

  try {
    const s3Client = getS3Client();
    const data = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.MINIO_BUCKET,
      Key: key,
      ...(range ? { Range: range } : {}),
    }));

    const contentType = data.ContentType || inferContentType(key);
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...CORS_HEADERS,
    };
    if (data.ContentRange) headers['Content-Range'] = data.ContentRange;
    if (data.ContentLength) headers['Content-Length'] = String(data.ContentLength);

    return new NextResponse(data.Body as ReadableStream, {
      status: range ? 206 : 200,
      headers,
    });
  } catch {
    return new NextResponse('Not found', { status: 404, headers: CORS_HEADERS });
  }
}

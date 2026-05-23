import { prisma } from '@shwp-rec/db';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  if (!await checkRateLimit(`streams-api:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get('cursor') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  try {
    const streams = await prisma.stream.findMany({
      where: { status: 'PUBLISHED' },
      include: { model: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = streams.length > limit;
    const page = hasMore ? streams.slice(0, limit) : streams;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({ streams: page, nextCursor });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

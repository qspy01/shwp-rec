import { prisma } from '@shwp-rec/db';
import { type StreamStatus } from '@shwp-rec/db';
import { NextRequest, NextResponse } from 'next/server';

const VALID_STATUSES = new Set<string>(['RECORDING', 'PROCESSING', 'PUBLISHED', 'FAILED']);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const statusParam = searchParams.get('status') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);

  const status: StreamStatus | undefined =
    statusParam && VALID_STATUSES.has(statusParam)
      ? (statusParam as StreamStatus)
      : undefined;

  const streams = await prisma.stream.findMany({
    where: status ? { status } : {},
    include: { model: true },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = streams.length > limit;
  const page = hasMore ? streams.slice(0, limit) : streams;
  return NextResponse.json({
    streams: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}

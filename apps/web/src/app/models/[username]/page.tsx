import { prisma } from '@shwp-rec/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SortSelector, type SortOption } from '@/components/SortSelector';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const VALID_SORTS = new Set<SortOption>(['date_desc', 'date_asc', 'duration_desc', 'duration_asc']);

function parseSort(raw: string | undefined): SortOption {
  if (raw && VALID_SORTS.has(raw as SortOption)) return raw as SortOption;
  return 'date_desc';
}

function buildOrderBy(sort: SortOption) {
  switch (sort) {
    case 'date_asc':    return { createdAt: 'asc' as const };
    case 'duration_desc': return { duration: { sort: 'desc' as const, nulls: 'last' as const } };
    case 'duration_asc':  return { duration: { sort: 'asc' as const, nulls: 'last' as const } };
    default:            return { createdAt: 'desc' as const };
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default async function ModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ sort?: string; cursor?: string }>;
}) {
  const { username } = await params;
  const { sort: sortRaw, cursor } = await searchParams;
  const sort = parseSort(sortRaw);

  const model = await prisma.model.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!model) notFound();

  const streams = await prisma.stream.findMany({
    where: { modelId: model.id, status: 'PUBLISHED' },
    orderBy: buildOrderBy(sort),
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const totalCount = await prisma.stream.count({
    where: { modelId: model.id, status: 'PUBLISHED' },
  });

  const hasMore = streams.length > PAGE_SIZE;
  const page = hasMore ? streams.slice(0, PAGE_SIZE) : streams;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const sortParam = sort !== 'date_desc' ? `&sort=${sort}` : '';

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      <Link href="/models">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          &larr; All Models
        </Button>
      </Link>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{model.username}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {totalCount} published recording{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Suspense>
          <SortSelector current={sort} />
        </Suspense>
      </div>

      {page.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground text-lg">No published recordings yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {page.map((stream) => (
              <Link key={stream.id} href={`/video/${stream.id}`} className="group block">
                <Card className="overflow-hidden h-full transition-shadow hover:shadow-md">
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    {stream.thumbnailKey ? (
                      <img
                        src={`/api/media/${stream.thumbnailKey}`}
                        alt={`${model.username} recording thumbnail`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">No thumbnail</span>
                      </div>
                    )}
                    {stream.duration && (
                      <Badge className="absolute bottom-2 right-2 bg-black/70 text-white border-0 text-xs">
                        {formatDuration(stream.duration)}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="text-muted-foreground text-xs">
                      {stream.createdAt.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                      {stream.resolution && (
                        <span className="ml-2">{stream.resolution}</span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-8">
            {cursor && (
              <Link href={`/models/${model.username}?${sortParam ? sortParam.slice(1) : ''}`}>
                <Button variant="outline" size="sm">&larr; First page</Button>
              </Link>
            )}
            {nextCursor && (
              <Link href={`/models/${model.username}?cursor=${nextCursor}${sortParam}`}>
                <Button variant="outline" size="sm">Next page &rarr;</Button>
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}

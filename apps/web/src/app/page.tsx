import { prisma } from '@shwp-rec/db';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/SearchBar';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; q?: string }>;
}) {
  const { cursor, q } = await searchParams;
  const usernameFilter = q?.trim() ?? '';

  const streams = await prisma.stream.findMany({
    where: {
      status: 'PUBLISHED',
      ...(usernameFilter
        ? { model: { username: { contains: usernameFilter, mode: 'insensitive' } } }
        : {}),
    },
    include: { model: true },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = streams.length > PAGE_SIZE;
  const page = hasMore ? streams.slice(0, PAGE_SIZE) : streams;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VOD Archive</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Automated recordings — latest streams first
          </p>
        </div>
        <Link href="/admin/queues">
          <Button variant="outline" size="sm">Admin Queues</Button>
        </Link>
      </div>

      <div className="mb-6">
        <Suspense>
          <SearchBar defaultValue={usernameFilter} />
        </Suspense>
      </div>

      {page.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground text-lg">
            {usernameFilter
              ? `No VODs found for "${usernameFilter}".`
              : 'No published VODs yet. The scheduler will pick up online models shortly.'}
          </p>
          {usernameFilter && (
            <Link href="/" className="mt-4">
              <Button variant="outline" size="sm">Clear filter</Button>
            </Link>
          )}
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
                        alt={`${stream.model.username} thumbnail`}
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
                    <p className="font-semibold truncate">{stream.model.username}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
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
              <Link href={usernameFilter ? `/?q=${encodeURIComponent(usernameFilter)}` : '/'}>
                <Button variant="outline" size="sm">&larr; First page</Button>
              </Link>
            )}
            {nextCursor && (
              <Link
                href={`/?cursor=${nextCursor}${usernameFilter ? `&q=${encodeURIComponent(usernameFilter)}` : ''}`}
              >
                <Button variant="outline" size="sm">Next page &rarr;</Button>
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}

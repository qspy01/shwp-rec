import { prisma } from '@shwp-rec/db';
import { type StreamStatus } from '@shwp-rec/db';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteButton } from './DeleteButton';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const STATUSES: Array<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Recording', value: 'RECORDING' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Failed', value: 'FAILED' },
];

const VALID_STATUSES = new Set(['RECORDING', 'PROCESSING', 'PUBLISHED', 'FAILED']);

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PUBLISHED: 'default',
  RECORDING: 'secondary',
  PROCESSING: 'outline',
  FAILED: 'destructive',
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default async function AdminStreamsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const { status: statusParam, cursor } = await searchParams;

  const status: StreamStatus | undefined =
    statusParam && VALID_STATUSES.has(statusParam)
      ? (statusParam as StreamStatus)
      : undefined;

  const streams = await prisma.stream.findMany({
    where: status ? { status } : {},
    include: { model: true },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = streams.length > PAGE_SIZE;
  const page = hasMore ? streams.slice(0, PAGE_SIZE) : streams;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  function buildUrl(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    if (params.status) sp.set('status', params.status);
    if (params.cursor) sp.set('cursor', params.cursor);
    const q = sp.toString();
    return `/admin/streams${q ? `?${q}` : ''}`;
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stream Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">All streams across all statuses</p>
        </div>
        <Link href="/admin/queues">
          <Button variant="outline" size="sm">Queue Monitor</Button>
        </Link>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUSES.map(({ label, value }) => (
          <Link
            key={value}
            href={buildUrl({ status: value || undefined })}
          >
            <Button
              variant={statusParam === value || (!statusParam && value === '') ? 'default' : 'outline'}
              size="sm"
            >
              {label}
            </Button>
          </Link>
        ))}
      </div>

      {page.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No streams found.</p>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Started</th>
                  <th className="text-left px-4 py-3 font-medium">Duration</th>
                  <th className="text-left px-4 py-3 font-medium">Resolution</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {page.map((stream) => (
                  <tr key={stream.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/models/${stream.model.username}`}
                        className="font-medium hover:underline"
                      >
                        {stream.model.username}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[stream.status] ?? 'outline'}>
                        {stream.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {stream.startTime.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDuration(stream.duration)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {stream.resolution ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteButton streamId={stream.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mt-6">
            {cursor && (
              <Link href={buildUrl({ status: statusParam || undefined })}>
                <Button variant="outline" size="sm">&larr; First page</Button>
              </Link>
            )}
            {nextCursor && (
              <Link href={buildUrl({ status: statusParam || undefined, cursor: nextCursor })}>
                <Button variant="outline" size="sm">Next page &rarr;</Button>
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}

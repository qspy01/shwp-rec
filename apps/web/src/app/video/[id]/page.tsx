import { prisma } from '@shwp-rec/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HlsPlayer } from '@/components/HlsPlayer';

export const dynamic = 'force-dynamic';

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const stream = await prisma.stream.findUnique({
    where: { id },
    include: { model: true },
  });

  if (!stream || (!stream.s3Key && !stream.hlsKey)) {
    notFound();
  }

  const hlsUrl = stream.hlsKey ? `/api/media/${stream.hlsKey}` : null;
  const mp4Url = stream.s3Key ? `/api/media/${stream.s3Key}` : null;
  const posterUrl = stream.thumbnailKey ? `/api/media/${stream.thumbnailKey}` : null;

  return (
    <main className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          &larr; Back to Gallery
        </Button>
      </Link>

      <div className="mb-4">
        <h1 className="text-2xl font-bold">
          <Link href={`/models/${stream.model.username}`} className="hover:underline underline-offset-2">
            {stream.model.username}
          </Link>
        </h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
          <span>
            {stream.createdAt.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          {stream.duration && (
            <Badge variant="secondary">
              {Math.floor(stream.duration / 60)}m {stream.duration % 60}s
            </Badge>
          )}
          {stream.resolution && (
            <Badge variant="secondary">{stream.resolution}</Badge>
          )}
        </div>
      </div>

      <div className="bg-black rounded-lg overflow-hidden">
        <HlsPlayer hlsUrl={hlsUrl} mp4Url={mp4Url} posterUrl={posterUrl} />
      </div>
    </main>
  );
}

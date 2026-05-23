import { prisma } from '@shwp-rec/db';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function ModelsPage() {
  const models = await prisma.model.findMany({
    where: { streams: { some: { status: 'PUBLISHED' } } },
    include: {
      _count: { select: { streams: { where: { status: 'PUBLISHED' } } } },
      streams: {
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { thumbnailKey: true },
      },
    },
    orderBy: { username: 'asc' },
  });

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Models</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {models.length} model{models.length !== 1 ? 's' : ''} with recorded content
        </p>
      </div>

      {models.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground text-lg">No published VODs yet.</p>
          <Link href="/" className="mt-4 text-sm underline underline-offset-4">
            Back to gallery
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {models.map((model) => {
            const thumbnail = model.streams[0]?.thumbnailKey;
            return (
              <Link key={model.id} href={`/models/${model.username}`} className="group block">
                <Card className="overflow-hidden h-full transition-shadow hover:shadow-md">
                  <div className="relative aspect-square bg-muted overflow-hidden">
                    {thumbnail ? (
                      <img
                        src={`/api/media/${thumbnail}`}
                        alt={`${model.username} preview`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-muted-foreground text-xs">No preview</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-2.5">
                    <p className="font-semibold text-sm truncate">{model.username}</p>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {model._count.streams} VOD{model._count.streams !== 1 ? 's' : ''}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

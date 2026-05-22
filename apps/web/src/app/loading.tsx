import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>

      <Skeleton className="h-9 w-64 mb-6" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-video w-full rounded-none" />
            <CardContent className="p-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      <Skeleton className="h-8 w-24 mb-4" />
      <Skeleton className="h-9 w-48 mb-2" />
      <Skeleton className="h-4 w-32 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </main>
  );
}

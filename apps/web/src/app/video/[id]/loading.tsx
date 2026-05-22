import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      <Skeleton className="h-8 w-28 mb-4" />
      <Skeleton className="h-8 w-64 mb-2" />
      <div className="flex gap-2 mb-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="w-full aspect-video rounded-lg" />
    </main>
  );
}

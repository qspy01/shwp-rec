'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        {error.message ?? 'An unexpected error occurred.'}
      </p>
      <div className="flex gap-3 mt-6">
        <Button onClick={reset}>Try again</Button>
        <Link href="/">
          <Button variant="outline">Back to gallery</Button>
        </Link>
      </div>
    </main>
  );
}

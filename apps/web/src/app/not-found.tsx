import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground mt-2">
        The page or video you are looking for does not exist.
      </p>
      <Link href="/" className="mt-6">
        <Button variant="outline">&larr; Back to gallery</Button>
      </Link>
    </main>
  );
}

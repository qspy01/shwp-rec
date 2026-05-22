'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Input } from '@/components/ui/input';

export function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      const value = e.target.value.trim();
      if (value) {
        params.set('q', value);
      } else {
        params.delete('q');
      }
      params.delete('cursor');
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams],
  );

  return (
    <Input
      type="search"
      placeholder="Filter by username..."
      defaultValue={defaultValue}
      onChange={handleChange}
      className="max-w-sm"
      aria-label="Filter VODs by username"
    />
  );
}

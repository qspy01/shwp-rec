'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export type SortOption = 'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc';

const SORT_LABELS: Record<SortOption, string> = {
  date_desc: 'Newest first',
  date_asc: 'Oldest first',
  duration_desc: 'Longest first',
  duration_asc: 'Shortest first',
};

export function SortSelector({ current }: { current: SortOption }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', e.target.value);
    params.delete('cursor');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}

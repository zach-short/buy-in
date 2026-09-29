import Link from 'next/link';

import type { SourceFilter } from '@pb/core';
import { cn } from '@/lib/utils';

const OPTIONS: readonly { source: SourceFilter; label: string }[] = [
  { source: 'all', label: 'All' },
  { source: 'home', label: 'Home games' },
  { source: 'logged', label: 'Logged' },
];

/** `?source=home|logged`; absent is All (logged-sessions PLAN.md BD-5). Anything else reads as All. */
export function parseSourceFilter(value: string | null): SourceFilter {
  return value === 'home' || value === 'logged' ? value : 'all';
}

function hrefFor(source: SourceFilter): string {
  return source === 'all' ? '/results?tab=poker' : `/results?tab=poker&source=${source}`;
}

/**
 * All / Home games / Logged (DESIGN.md D5). Lives in the URL, as the Results tab does, so a
 * filtered view can be linked to and survives a reload. Not shown when `?table=` narrows the
 * tab to one table: a table's games are all home games.
 */
export function SourceFilterBar({ active }: { active: SourceFilter }) {
  return (
    <nav aria-label='Which games' className='flex rounded-md border border-border p-0.5 mb-6'>
      {OPTIONS.map(({ source, label }) => (
        <Link
          key={source}
          href={hrefFor(source)}
          replace
          scroll={false}
          aria-current={source === active ? 'page' : undefined}
          className={cn(
            'flex-1 rounded py-2 text-center text-xs tracking-widest uppercase transition-colors',
            source === active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

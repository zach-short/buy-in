import Link from 'next/link';

import type { TypeOption } from '@pb/core';
import { cn } from '@/lib/utils';

const ALL = 'all';

/** `?type=<slug>`; absent, or a slug the player has no rows of, is All (log-events PLAN.md BD-6). */
export function parseTypeFilter(value: string | null, chips: readonly TypeOption[]): string {
  return value && chips.some((chip) => chip.slug === value) ? value : ALL;
}

function hrefFor(slug: string): string {
  return slug === ALL ? '/results?tab=everything' : `/results?tab=everything&type=${slug}`;
}

/**
 * All plus one chip per type the player has logged (SCOPE Dial 8). Lives in the URL, as the
 * source filter on My poker does, so a filtered view can be linked to and survives a reload.
 * Chips wrap rather than scroll: the list grows with the registry, and a wrapped chip is never
 * hidden off the edge of a phone.
 */
export function TypeFilterBar({ chips, active }: { chips: readonly TypeOption[]; active: string }) {
  return (
    <nav aria-label='Which kind' className='flex flex-wrap gap-2 mb-6'>
      {[{ slug: ALL, label: 'All' }, ...chips].map(({ slug, label }) => (
        <Link
          key={slug}
          href={hrefFor(slug)}
          replace
          scroll={false}
          aria-current={slug === active ? 'page' : undefined}
          className={cn(
            'flex h-11 items-center rounded-full border px-4 text-xs tracking-widest uppercase transition-colors',
            slug === active ? 'border-primary bg-muted text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

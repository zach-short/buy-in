import Link from 'next/link';

import { cn } from '@/lib/utils';

export type ResultsTab = 'poker' | 'bar';

const TABS: readonly { tab: ResultsTab; label: string }[] = [
  { tab: 'poker', label: 'My poker' },
  { tab: 'bar', label: 'The bar' },
];

/** The tab lives in the URL (`?tab=bar`) so a result view can be linked to and survives reload. */
export function ResultsTabs({ active }: { active: ResultsTab }) {
  return (
    <nav className='flex gap-6 border-b border-border mb-8'>
      {TABS.map(({ tab, label }) => (
        <Link
          key={tab}
          href={`/results?tab=${tab}`}
          replace
          scroll={false}
          aria-current={tab === active ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 py-3 text-xs tracking-widest uppercase transition-colors',
            tab === active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Where an empty tab points next, so a new account is never left at a dead end. */
export function EmptyResults({ title, detail, href, action }: { title: string; detail: string; href: string; action: string }) {
  return (
    <div className='text-center py-24 space-y-3'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>{title}</p>
      <p className='text-xs text-muted-foreground max-w-xs mx-auto'>{detail}</p>
      <Link href={href} className='inline-block text-xs tracking-widest uppercase text-primary hover:text-foreground transition-colors'>
        {action} ›
      </Link>
    </div>
  );
}

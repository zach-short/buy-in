import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

// One frame for every app page. The width, padding and header geometry below are fixed on
// purpose: pages that each picked their own made the title jump when navigating between them.
// w-full because the app shell is a flex column and mx-auto turns off its stretch: without it
// the page shrink-wraps to its widest row and a phone scrolls sideways.
export function PageMain({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn('min-h-dvh w-full px-6 pt-10 pb-24 max-w-3xl mx-auto', className)}>{children}</main>;
}

// The subtitle line is always reserved, so a page without one starts its content at the same
// height as a page with one. Actions sit on the title's line, never on the subtitle's — unless
// they cannot fit beside it (four actions on a phone), when they wrap to a line of their own
// rather than pushing the page wider than the screen. The title counts as only 8rem when
// deciding to wrap, so one short action never wraps: it just narrows the subtitle.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className='flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-10'>
      <div className='min-w-32 grow basis-0'>
        <h1 className='h-6 text-base leading-6 font-semibold tracking-widest uppercase text-primary truncate'>{title}</h1>
        <p className='mt-0.5 min-h-4 text-xs leading-4 text-muted-foreground'>{subtitle}</p>
      </div>
      {actions && <div className='ml-auto flex h-6 shrink-0 items-center gap-4'>{actions}</div>}
    </header>
  );
}

const HEADER_ACTION_TONE = {
  // Back, Edit and the like: grey until hovered.
  default: 'text-muted-foreground hover:text-foreground',
  // The page's main action ("+ Add"), gold so it does not read like Back beside it.
  primary: 'font-semibold text-primary hover:text-primary/80',
} as const;

// The padding grows the tap target without growing the row, which would move the title.
export function HeaderAction({
  className,
  type = 'button',
  tone = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof HEADER_ACTION_TONE }) {
  return (
    <button
      type={type}
      className={cn(
        '-my-3.5 py-3.5 text-xs tracking-widest uppercase transition-colors',
        HEADER_ACTION_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

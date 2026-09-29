import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

// One frame for every app page. The width, padding and header geometry below are fixed on
// purpose: pages that each picked their own made the title jump when navigating between them.
export function PageMain({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn('min-h-screen px-6 pt-10 pb-24 max-w-3xl mx-auto', className)}>{children}</main>;
}

// The subtitle line is always reserved, so a page without one starts its content at the same
// height as a page with one. Actions sit on the title's line, never on the subtitle's.
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
    <header className='flex items-start justify-between gap-4 mb-10'>
      <div className='min-w-0'>
        <h1 className='h-6 text-base leading-6 font-semibold tracking-widest uppercase text-primary truncate'>{title}</h1>
        <p className='mt-0.5 min-h-4 text-xs leading-4 text-muted-foreground'>{subtitle}</p>
      </div>
      {actions && <div className='flex h-6 shrink-0 items-center gap-4'>{actions}</div>}
    </header>
  );
}

// The padding grows the tap target without growing the row, which would move the title.
export function HeaderAction({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        '-my-3 py-3 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors',
        className,
      )}
      {...props}
    />
  );
}

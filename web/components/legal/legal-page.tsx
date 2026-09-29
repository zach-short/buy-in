import type { ReactNode } from 'react';
import Link from 'next/link';

export const CONTACT_EMAIL = 'admin@buy-in.win';

// Google's brand verification reads these pages, so they stay public and readable without an
// account (proxy.ts) and carry a visible last-updated date.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className='min-h-dvh w-full px-6 pt-10 pb-24 max-w-2xl mx-auto'>
      <Link href='/' className='font-display text-sm font-semibold tracking-widest uppercase text-primary'>
        Buy-In
      </Link>
      <h1 className='mt-10 text-2xl font-semibold tracking-wide'>{title}</h1>
      <p className='mt-1 text-xs text-muted-foreground'>Last updated {updated}</p>
      <div className='mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground'>{children}</div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='space-y-3'>
      <h2 className='text-xs font-semibold tracking-widest uppercase text-foreground'>{title}</h2>
      {children}
    </section>
  );
}

export function ContactLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className='text-primary underline-offset-4 hover:underline'>
      {CONTACT_EMAIL}
    </a>
  );
}

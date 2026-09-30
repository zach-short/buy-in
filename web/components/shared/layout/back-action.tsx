'use client';

import Link from 'next/link';

import { useGoBack } from '@/hooks/use-go-back';
import { HeaderAction } from './page';

// px-2 with -mx-2 widens the tap target past the ~32px word without moving the label.
const WIDEN = 'px-2 -mx-2';
const LINK_CLASS = `${WIDEN} -my-3.5 py-3.5 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors`;

// `href` pins the destination for pages where history is the wrong answer — the live table and
// its summary redirect into each other, so popping back from one lands on the other.
export function BackAction({ fallback = '/', href }: { fallback?: string; href?: string }) {
  const goBack = useGoBack(fallback);
  if (href) return <Link href={href} className={LINK_CLASS}>Back</Link>;
  return <HeaderAction onClick={goBack} className={WIDEN}>Back</HeaderAction>;
}

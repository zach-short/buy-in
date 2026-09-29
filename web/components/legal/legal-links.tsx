import Link from 'next/link';

import { cn } from '@/lib/utils';

const LINK = 'hover:text-foreground transition-colors';

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label='Legal' className={cn('flex items-center gap-4 text-xs text-muted-foreground', className)}>
      <Link href='/privacy' className={LINK}>Privacy</Link>
      <Link href='/terms' className={LINK}>Terms</Link>
    </nav>
  );
}

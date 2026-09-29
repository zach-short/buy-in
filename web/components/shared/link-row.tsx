import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface LinkRowProps {
  href: string;
  label: string;
  icon: LucideIcon;
  /** `default` carries the gold border that marks the main action; `outline` is everything else. */
  variant?: 'default' | 'outline';
}

// A navigation row drawn as an outlined button, so a link to another screen reads as
// pressable: information on this page is plain text or a filled panel, never a bordered box.
export function LinkRow({ href, label, icon: Icon, variant = 'outline' }: LinkRowProps) {
  return (
    <Button asChild variant={variant} className='h-12 w-full justify-start px-4 text-xs tracking-widest uppercase'>
      <Link href={href}>
        <Icon aria-hidden='true' />
        {label}
        <ChevronRight aria-hidden='true' className='ml-auto text-primary' />
      </Link>
    </Button>
  );
}

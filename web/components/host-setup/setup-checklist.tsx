'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import { toast } from 'sonner';

import type { SetupItem } from '@/hooks/use-setup-guide';

interface SetupChecklistProps {
  items: SetupItem[];
  onDismiss: () => Promise<void>;
}

// Host-setup phase 3, step 2. Copy: warm register, chosen by the owner 2026-09-29 (R7). A done
// item is not a link: there is nothing left to do there.
export function SetupChecklist({ items, onDismiss }: SetupChecklistProps) {
  const [dismissing, setDismissing] = useState(false);

  async function dismiss() {
    setDismissing(true);
    try {
      await onDismiss();
    } catch (e) {
      toast.error((e as Error).message);
      setDismissing(false);
    }
  }

  return (
    <div className='mb-10'>
      <div className='flex items-baseline justify-between mb-4'>
        <p className='text-xs tracking-widest uppercase text-muted-foreground'>Let&apos;s get your table ready</p>
        <button
          type='button'
          disabled={dismissing}
          onClick={dismiss}
          className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground disabled:opacity-50'
        >
          I&apos;m all set
        </button>
      </div>
      <ul className='border border-border rounded-md divide-y divide-border'>
        {items.map((item) => (
          <li key={item.key}>
            {item.done ? <DoneRow label={item.label} /> : <TodoRow label={item.label} href={item.href} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DoneRow({ label }: { label: string }) {
  return (
    <div className='flex items-center gap-3 p-4 text-sm text-muted-foreground'>
      <Check className='size-4 text-primary shrink-0' aria-hidden />
      <span className='line-through'>{label}</span>
      <span className='sr-only'>, done</span>
    </div>
  );
}

function TodoRow({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className='flex items-center gap-3 p-4 text-sm hover:text-primary transition-colors'>
      <Circle className='size-4 text-muted-foreground shrink-0' aria-hidden />
      <span className='flex-1'>{label}</span>
      <span className='text-primary' aria-hidden>›</span>
    </Link>
  );
}

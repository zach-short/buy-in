'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';

import { fetchBarSettings, reopenSetup } from '@/lib/supabase/bar-settings';
import { forgetDrinksAnswered } from '@/lib/setup-drinks-answered';

// Host-setup phase 3, step 3: its own row (owner, 2026-09-29), shown only while the guide is
// dismissed — while it is on Home there is nothing to bring back. Reopening also forgets this
// browser's drinks answer, so the whole guide returns, question included.
export function SetupGuideSetting() {
  const router = useRouter();
  const { data: bar, mutate } = useSWR('bar_settings', fetchBarSettings);
  const [opening, setOpening] = useState(false);
  if (!bar?.setupDismissedAt) return null;

  async function reopen() {
    if (!bar) return;
    setOpening(true);
    try {
      await reopenSetup(bar.barId);
      forgetDrinksAnswered(bar.barId);
      await mutate();
      router.push('/');
    } catch (e) {
      toast.error((e as Error).message);
      setOpening(false);
    }
  }

  return (
    <button
      type='button'
      disabled={opening}
      onClick={reopen}
      className='w-full flex items-center justify-between border border-border rounded-md p-4 mb-6 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50'
    >
      Show setup guide
      <span className='text-primary'>›</span>
    </button>
  );
}

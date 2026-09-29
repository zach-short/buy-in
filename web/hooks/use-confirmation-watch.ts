'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

const POLL_MS = 3000;

// The confirm link is usually opened in another tab of this browser, and /auth/callback sets the
// session cookie there. Nothing tells this tab, so it asks: on a timer, and the moment it
// regains focus. Cookies are read fresh on each getSession(), so the other tab's session shows
// up here. The proxy still guards `next`; this only saves the visitor a manual refresh.
export function useConfirmationWatch(next: string): void {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let done = false;

    async function check(): Promise<void> {
      if (done) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session || done) return;
      done = true;
      router.replace(next);
    }

    function onVisible(): void {
      if (!document.hidden) void check();
    }

    void check();
    const timer = window.setInterval(onVisible, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      done = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [next, router]);
}

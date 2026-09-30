'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, CircleStop } from 'lucide-react';

import { Button } from '@/components/ui/button';

function formatElapsed(since: string, now: number) {
  const diff = now - new Date(since).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

// The channel is briefly not SUBSCRIBED on every mount while it joins; only a gap that lasts
// is worth telling the host about.
const RECONNECT_GRACE_MS = 4000;

function useLastingFlag(active: boolean, ms: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setShown(true), ms);
    return () => {
      clearTimeout(t);
      setShown(false);
    };
  }, [active, ms]);
  return active && shown;
}

interface SessionTopBarProps {
  name: string;
  playedOn: string;
  subscribed: boolean;
  onEnd: () => void;
}

export function SessionTopBar({ name, playedOn, subscribed, onEnd }: SessionTopBarProps) {
  const now = useMinuteClock();
  const reconnecting = useLastingFlag(!subscribed, RECONNECT_GRACE_MS);

  return (
    <div className='sticky top-[env(safe-area-inset-top)] z-10 bg-background/95 backdrop-blur border-b border-border'>
      <div className='px-6 py-3 flex items-center justify-between gap-3'>
        {/* Pinned to Home: history would land on /session/new, which only starts another night. */}
        <Link href='/' aria-label='Back to home' className='-ml-2 flex h-11 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors'>
          <ChevronLeft size={22} />
        </Link>
        <div className='min-w-0 grow'>
          <h1 className='text-base font-semibold tracking-widest uppercase text-primary truncate'>{name}</h1>
          <p className='text-xs text-muted-foreground mt-0.5'>{formatElapsed(playedOn, now)}</p>
        </div>
        {/* Grey, not red: it only opens the cash-out screen, which has its own confirm, so it
            should not be the loudest thing on a screen the host uses all night. */}
        <Button variant='outline' size='sm' className='shrink-0 h-11 text-xs tracking-widest uppercase text-muted-foreground' onClick={onEnd}>
          <CircleStop aria-hidden='true' />
          End Session
        </Button>
      </div>
      {reconnecting && (
        // Not live, but not stale for long either: the page polls every 15 s meanwhile.
        <p role='status' className='px-6 py-1 text-[11px] tracking-widest uppercase text-muted-foreground bg-secondary'>
          Reconnecting… other devices&apos; changes may take a few seconds to show
        </p>
      )}
    </div>
  );
}

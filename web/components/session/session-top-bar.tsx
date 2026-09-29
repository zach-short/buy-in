'use client';

import { useEffect, useState } from 'react';

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
    <div className='sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border'>
      <div className='px-6 py-3 flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <h1 className='text-base font-semibold tracking-widest uppercase text-primary truncate'>{name}</h1>
          <p className='text-xs text-muted-foreground mt-0.5'>{formatElapsed(playedOn, now)}</p>
        </div>
        <Button variant='destructive' size='sm' className='shrink-0 h-11 text-xs tracking-widest uppercase' onClick={onEnd}>
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

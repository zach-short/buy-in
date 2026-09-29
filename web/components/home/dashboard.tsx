'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import { formatCents } from '@pb/core';
import { Play, Plus } from 'lucide-react';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { sumCents } from '@/lib/ledger';
import { createClient } from '@/lib/supabase/client';
import { fetchHomeSessions, type HomeSessions } from '@/lib/supabase/home-queries';
import { fetchSessionOrders } from '@/lib/supabase/queries';
import { Button } from '@/components/ui/button';
import { SetupGuide } from '@/components/host-setup/setup-guide';
import { NextGameCard } from '@/components/shared/next-game-card';
import { useBarFeatures } from '@/hooks/use-bar-features';

interface DashboardProps {
  /** Read by the server page for this request; `null` when that read failed, so this one fetches. */
  initialSessions: HomeSessions | null;
}

// The key carries the server's answer, so a cache entry from an earlier visit (a session since
// closed or started) never renders over this request's fresher one; SWR still revalidates on
// focus, as the old 'sessions' read did.
function homeSessionsKey(initial: HomeSessions | null) {
  return ['home_sessions', initial?.active?.id ?? null, initial?.lastClosed?.id ?? null] as const;
}

function useHomeSessions(initial: HomeSessions | null): HomeSessions | undefined {
  const { data } = useSWR(homeSessionsKey(initial), () => fetchHomeSessions(createClient()), {
    fallbackData: initial ?? undefined,
  });
  return data;
}

export function Dashboard({ initialSessions }: DashboardProps) {
  const router = useRouter();
  const sessions = useHomeSessions(initialSessions);
  const lastClosed = sessions?.lastClosed ?? null;
  const activeSession = sessions?.active ?? null;
  // Revenue, cost and profit are drink money, so the card and its read go with stats (host-setup P2).
  const showBar = useBarFeatures().visible.stats;
  const { data: lastOrders } = useSWR(
    showBar && lastClosed ? ['orders', lastClosed.id] : null,
    ([, sessionId]) => fetchSessionOrders(sessionId),
  );

  const revenueCents = lastOrders ? sumCents(lastOrders, (o) => o.price_cents) : 0;
  const cogsCents = lastOrders ? sumCents(lastOrders, (o) => o.cost_estimate_cents) : 0;
  const profitCents = revenueCents - cogsCents;

  return (
    <PageMain className='flex flex-col'>
      <PageHeader title='Home' />

      <div className='flex flex-col gap-3 mb-10'>
        {activeSession ? (
          <Button
            size='lg'
            className='h-12 text-sm tracking-widest uppercase font-medium'
            onClick={() => router.push(`/session/${activeSession.id}`)}
          >
            <Play aria-hidden='true' />
            Resume — {activeSession.name}
          </Button>
        ) : (
          <Button
            size='lg'
            className='h-12 text-sm tracking-widest uppercase font-medium'
            onClick={() => router.push('/session/new')}
          >
            <Plus aria-hidden='true' />
            Start New Session
          </Button>
        )}
      </div>

      <SetupGuide />

      <NextGameCard canStart={!activeSession} />

      {showBar && lastClosed && (
        <div>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-4'>Last Session</p>
          <button className='w-full border border-border rounded-md p-4 text-left hover:border-primary/50 transition-colors' onClick={() => router.push(`/session/${lastClosed.id}/summary`)}>
            <p className='text-sm font-medium mb-3'>{lastClosed.name}</p>
            <div className='grid grid-cols-3 gap-2 text-center'>
              <div>
                <p className='text-xs text-muted-foreground mb-1'>Revenue</p>
                <p className='text-base font-semibold text-primary'>${formatCents(revenueCents)}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground mb-1'>Cost</p>
                <p className='text-base font-semibold'>${formatCents(cogsCents)}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground mb-1'>Profit</p>
                <p className={`text-base font-semibold ${profitCents >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  ${formatCents(profitCents)}
                </p>
              </div>
            </div>
          </button>
        </div>
      )}
    </PageMain>
  );
}

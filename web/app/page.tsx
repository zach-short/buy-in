'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import { formatCents } from '@pb/core';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { sumCents } from '@/lib/ledger';
import { fetchSessions, fetchSessionOrders } from '@/lib/supabase/queries';
import { Button } from '@/components/ui/button';
import { Landing } from '@/components/landing/landing';
import { MemberHome } from '@/components/member/member-home';
import { NextGameCard } from '@/components/shared/next-game-card';
import { useAuthUser } from '@/hooks/use-auth-user';
import { useBarFeatures } from '@/hooks/use-bar-features';
import { useIsBarStaff } from '@/hooks/use-is-bar-staff';

function Dashboard() {
  const router = useRouter();
  const { data: sessions } = useSWR('sessions', fetchSessions);
  const lastClosed = sessions?.find((s) => s.status === 'closed');
  // Revenue, cost and profit are drink money, so the card and its read go with stats (host-setup P2).
  const showBar = useBarFeatures().visible.stats;
  const { data: lastOrders } = useSWR(
    showBar && lastClosed ? ['orders', lastClosed.id] : null,
    ([, sessionId]) => fetchSessionOrders(sessionId),
  );

  const revenueCents = lastOrders ? sumCents(lastOrders, (o) => o.price_cents) : 0;
  const cogsCents = lastOrders ? sumCents(lastOrders, (o) => o.cost_estimate_cents) : 0;
  const profitCents = revenueCents - cogsCents;
  const activeSession = sessions?.find((s) => s.status === 'active');

  return (
    <PageMain className='flex flex-col'>
      <PageHeader title='Buy-In' />

      <div className='flex flex-col gap-3 mb-10'>
        {activeSession ? (
          <Button
            size='lg'
            className='h-12 text-sm tracking-widest uppercase font-medium'
            onClick={() => router.push(`/session/${activeSession.id}`)}
          >
            Resume — {activeSession.name}
          </Button>
        ) : (
          <Button
            size='lg'
            className='h-12 text-sm tracking-widest uppercase font-medium'
            onClick={() => router.push('/session/new')}
          >
            Start New Session
          </Button>
        )}
      </div>

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

// A joined player lands here after /join (use-join-flow.ts), so an account that hosts nowhere
// gets its tables, never the host's Start New Session. Nothing renders until the staff read
// returns, so neither Home flashes at the wrong account (member-home SCOPE.md §5 H1, H8).
export default function HomePage() {
  const { status } = useAuthUser();
  const isStaff = useIsBarStaff();
  if (status === 'loading') return null;
  if (status !== 'authenticated') return <Landing />;
  if (isStaff === undefined) return null;
  return isStaff ? <Dashboard /> : <MemberHome />;
}

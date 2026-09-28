'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import { formatCents } from '@pb/core';
import { sumCents } from '@/lib/ledger';
import { fetchSessions, fetchSessionOrders } from '@/lib/supabase/queries';
import { Button } from '@/components/ui/button';
import { useAuthUser } from '@/hooks/use-auth-user';
import { signOutToLanding } from '@/lib/supabase/sign-out';

function Landing() {
  const router = useRouter();
  return (
    <main className='min-h-screen flex flex-col items-center justify-center px-6'>
      <div className='w-full max-w-xs space-y-8 text-center'>
        <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
        {/* No Menu button: a menu belongs to a bar, and a logged-out visitor has none. Guests
            reach one through the /menu/<bar id> link a host shares (owner, 2026-09-27). */}
        <div className='flex flex-col gap-3'>
          <Button
            size='lg'
            variant='outline'
            className='h-12 text-xs tracking-widest uppercase'
            onClick={() => router.push('/login')}
          >
            Login
          </Button>
        </div>
      </div>
    </main>
  );
}

function Dashboard() {
  const router = useRouter();
  const { data: sessions } = useSWR('sessions', fetchSessions);
  const lastClosed = sessions?.find((s) => s.status === 'closed');
  const { data: lastOrders } = useSWR(
    lastClosed ? ['orders', lastClosed.id] : null,
    ([, sessionId]) => fetchSessionOrders(sessionId),
  );

  const revenueCents = lastOrders ? sumCents(lastOrders, (o) => o.price_cents) : 0;
  const cogsCents = lastOrders ? sumCents(lastOrders, (o) => o.cost_estimate_cents) : 0;
  const profitCents = revenueCents - cogsCents;
  const activeSession = sessions?.find((s) => s.status === 'active');

  return (
    <main className='min-h-screen px-6 py-10 max-w-sm mx-auto flex flex-col'>
      <div className='flex items-center justify-between mb-12'>
        <h1 className='text-xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
        <button
          onClick={signOutToLanding}
          className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
        >
          Sign out
        </button>
      </div>

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

      <nav className='flex flex-col border-t border-border'>
        {[
          { label: 'Sessions', path: '/sessions' },
          { label: 'Schedule', path: '/schedule' },
          { label: 'Players', path: '/players' },
          { label: 'Stats', path: '/stats' },
          { label: 'Inventory', path: '/inventory' },
          { label: 'Drinks', path: '/drinks' },
          { label: 'Menu', path: '/menu' },
        ].map(({ label, path }) => (
          <button
            key={path}
            onClick={() => router.push(path)}
            className='flex items-center justify-between py-4 border-b border-border text-sm tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors text-left'
          >
            {label}
            <span className='text-primary text-xs'>›</span>
          </button>
        ))}
      </nav>

      {lastClosed && (
        <div className='mt-10'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-4'>Last Session</p>
          <button className='w-full border border-border rounded-md p-4 text-left hover:border-primary/50 transition-colors' onClick={() => router.push(`/session/${lastClosed.id}`)}>
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
    </main>
  );
}

export default function HomePage() {
  const { status } = useAuthUser();
  if (status === 'loading') return null;
  return status === 'authenticated' ? <Dashboard /> : <Landing />;
}

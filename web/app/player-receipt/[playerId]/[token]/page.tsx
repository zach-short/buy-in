'use client';

import { use } from 'react';
import useSWR from 'swr';
import {
  fetcher, computeBalance, openVenmo,
  formatDate, formatTime,
  Order, BuyIn, Cashout, Payment, Player, Session,
} from '@/lib/bar-api';

const VENMO_HANDLE = process.env.NEXT_PUBLIC_VENMO_HANDLE ?? '';

function VenmoIcon() {
  return (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='white'>
      <path d='M19.07 3C19.82 4.27 20.16 5.58 20.16 7.22C20.16 12.23 15.68 18.72 12.05 22H4.27L1 4.36L8.19 3.67L9.84 15.05C11.42 12.36 13.38 8.19 13.38 5.42C13.38 3.97 13.1 2.97 12.68 2.14L19.07 3Z' />
    </svg>
  );
}

export default function PlayerReceiptPage({
  params,
}: {
  params: Promise<{ playerId: string; token: string }>;
}) {
  const { playerId, token } = use(params);

  const { data: auth, error: authError } = useSWR<{ valid: boolean; player: Player }>(
    `/api/portal/${playerId}/validate?token=${token}`,
    fetcher,
  );

  const enabled = auth?.valid ?? false;
  const { data: sessions = [] }  = useSWR<Session[]>(enabled ? '/api/sessions' : null, fetcher);
  const { data: orders = [] }    = useSWR<Order[]>(enabled ? '/api/orders' : null, fetcher);
  const { data: buyIns = [] }    = useSWR<BuyIn[]>(enabled ? '/api/buyins' : null, fetcher);
  const { data: cashouts = [] }  = useSWR<Cashout[]>(enabled ? '/api/cashouts' : null, fetcher);
  const { data: payments = [] }  = useSWR<Payment[]>(enabled ? `/api/payments?playerId=${playerId}` : null, fetcher);

  if (authError) {
    return (
      <div className='min-h-screen flex items-center justify-center px-6'>
        <div className='text-center space-y-2'>
          <p className='text-sm font-medium text-destructive'>Invalid link</p>
          <p className='text-xs text-muted-foreground'>This link may be outdated. Ask for a new one.</p>
        </div>
      </div>
    );
  }

  if (!auth) {
    return (
      <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
        Loading…
      </div>
    );
  }

  const player = auth.player;
  const balance = computeBalance(playerId, orders, buyIns, cashouts, payments);

  const sessionGroups = sessions
    .filter((s) =>
      orders.some((o) => o.sessionId === s.id && o.playerId === playerId) ||
      buyIns.some((b) => b.sessionId === s.id && b.playerId === playerId),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((session) => {
      const sessionOrders = orders
        .filter((o) => o.sessionId === session.id && o.playerId === playerId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const sessionBuyIns = buyIns.filter(
        (b) => b.sessionId === session.id && b.playerId === playerId,
      );
      const sessionCashout = cashouts.find(
        (c) => c.sessionId === session.id && c.playerId === playerId,
      );
      const drinkTotal  = sessionOrders.reduce((s, o) => s + o.price, 0);
      const buyInTotal  = sessionBuyIns.reduce((s, b) => s + b.amount, 0);
      const cashoutAmount = sessionCashout?.amount ?? 0;
      const sessionNet  = drinkTotal + buyInTotal - cashoutAmount;
      return { session, sessionOrders, sessionBuyIns, sessionCashout, drinkTotal, buyInTotal, cashoutAmount, sessionNet };
    });

  function handleVenmo() {
    const h = VENMO_HANDLE.replace(/^@/, '');
    const note = encodeURIComponent('poker');
    if (balance > 0) {
      // Player owes owner — player pays owner
      const deep = `venmo://paycharge?txn=pay&recipients=${h}&amount=${balance.toFixed(2)}&note=${note}`;
      const web  = `https://account.venmo.com/pay?recipients=${h}&amount=${balance.toFixed(2)}&note=${note}`;
      window.location.href = deep;
      setTimeout(() => { if (!document.hidden) window.location.href = web; }, 1500);
    } else {
      // Owner owes player — player charges owner
      const amt = Math.abs(balance).toFixed(2);
      const deep = `venmo://paycharge?txn=charge&recipients=${h}&amount=${amt}&note=${note}`;
      const web  = `https://account.venmo.com/pay?txn=charge&recipients=${h}&amount=${amt}&note=${note}`;
      window.location.href = deep;
      setTimeout(() => { if (!document.hidden) window.location.href = web; }, 1500);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
        .pr-wrap {
          min-height: 100vh;
          padding: 2.5rem 1.25rem 4rem;
          max-width: 420px;
          margin: 0 auto;
          font-family: 'Courier Prime', 'Courier New', monospace;
        }
        .pr-header { margin-bottom: 1.5rem; }
        .pr-venue {
          font-size: 0.65rem;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--muted-foreground);
          margin-bottom: 0.2rem;
        }
        .pr-name {
          font-size: 1.4rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--primary);
        }
        .pr-balance-card {
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .pr-balance-label {
          font-size: 0.6rem;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: var(--muted-foreground);
          margin-bottom: 0.25rem;
        }
        .pr-balance-amount {
          font-size: 1.6rem;
          font-weight: 700;
          line-height: 1;
        }
        .pr-balance-sub {
          font-size: 0.6rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--muted-foreground);
          margin-top: 0.2rem;
        }
        .pr-venmo-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.7rem 1rem;
          background: #3D95CE;
          color: #fff;
          border: none;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          font-family: inherit;
        }
        .pr-section-label {
          font-size: 0.6rem;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: var(--muted-foreground);
          margin: 1.5rem 0 0.75rem;
        }
        .pr-session {
          border: 1px solid var(--border);
          border-radius: 4px;
          margin-bottom: 0.75rem;
          overflow: hidden;
        }
        .pr-session-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
        }
        .pr-session-name { font-size: 0.8rem; font-weight: 700; }
        .pr-session-date { font-size: 0.65rem; color: var(--muted-foreground); margin-top: 0.1rem; }
        .pr-session-net { font-size: 0.8rem; font-weight: 700; text-align: right; }
        .pr-session-net-label { font-size: 0.6rem; color: var(--muted-foreground); text-align: right; margin-top: 0.1rem; }
        .pr-session-body { padding: 0.6rem 1rem; }
        .pr-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 0.5rem;
          font-size: 0.75rem;
          padding: 0.2rem 0;
          color: var(--muted-foreground);
        }
        .pr-row-name { flex: 1; }
        .pr-row-time { font-size: 0.6rem; color: var(--muted-foreground); margin-left: 0.3rem; opacity: 0.7; }
        .pr-row-amount { font-weight: 700; white-space: nowrap; }
        .pr-cashout { color: #22c55e; }
        .pr-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.72rem;
          font-weight: 700;
          padding-top: 0.5rem;
          margin-top: 0.35rem;
          border-top: 1px dashed var(--border);
          color: var(--foreground);
        }
        .pr-empty {
          text-align: center;
          font-size: 0.75rem;
          color: var(--muted-foreground);
          padding: 2rem 0;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
      `}</style>

      <div className='pr-wrap'>
        <div className='pr-header'>
          <p className='pr-venue'>Poker Bar</p>
          <p className='pr-name'>{player.name}</p>
        </div>

        <div className='pr-balance-card'>
          <div>
            <p className='pr-balance-label'>Running Balance</p>
            {Math.abs(balance) < 0.01 ? (
              <p className='pr-balance-amount' style={{ color: 'var(--muted-foreground)', fontSize: '1.1rem' }}>All settled up</p>
            ) : (
              <>
                <p className='pr-balance-amount' style={{ color: balance > 0 ? 'var(--destructive)' : '#22c55e' }}>
                  ${Math.abs(balance).toFixed(2)}
                </p>
                <p className='pr-balance-sub'>{balance > 0 ? 'you owe' : 'owed to you'}</p>
              </>
            )}
          </div>
          {VENMO_HANDLE && Math.abs(balance) >= 0.01 && (
            <button onClick={handleVenmo} className='pr-venmo-btn'>
              <VenmoIcon />
              {balance > 0 ? 'Pay' : 'Request'}
            </button>
          )}
        </div>

        <p className='pr-section-label'>Session History</p>

        {sessionGroups.length === 0 ? (
          <p className='pr-empty'>No history yet</p>
        ) : (
          sessionGroups.map(({ session, sessionOrders, sessionBuyIns, sessionCashout, drinkTotal, buyInTotal, cashoutAmount, sessionNet }) => (
            <div key={session.id} className='pr-session'>
              <div className='pr-session-head'>
                <div>
                  <p className='pr-session-name'>{session.name}</p>
                  <p className='pr-session-date'>{formatDate(session.date)}</p>
                </div>
                <div>
                  <p className='pr-session-net' style={{ color: sessionNet > 0 ? 'var(--destructive)' : sessionNet < 0 ? '#22c55e' : 'var(--muted-foreground)' }}>
                    {sessionNet > 0 ? `+$${sessionNet.toFixed(2)}` : sessionNet < 0 ? `-$${Math.abs(sessionNet).toFixed(2)}` : 'Even'}
                  </p>
                  <p className='pr-session-net-label'>net</p>
                </div>
              </div>
              <div className='pr-session-body'>
                {sessionBuyIns.map((b, i) => (
                  <div key={b.id} className='pr-row'>
                    <span className='pr-row-name'>{i === 0 ? 'Buy-in' : 'Re-buy'}</span>
                    <span className='pr-row-amount'>+${b.amount.toFixed(2)}</span>
                  </div>
                ))}
                {sessionOrders.map((o) => (
                  <div key={o.id} className='pr-row'>
                    <span className='pr-row-name'>
                      {o.drinkName}
                      <span className='pr-row-time'>{formatTime(o.timestamp)}</span>
                    </span>
                    <span className='pr-row-amount'>+${o.price.toFixed(2)}</span>
                  </div>
                ))}
                {sessionCashout && (
                  <div className='pr-row pr-cashout'>
                    <span className='pr-row-name'>Cashout</span>
                    <span className='pr-row-amount'>−${cashoutAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className='pr-total-row'>
                  <span>Session total</span>
                  <span>${(drinkTotal + buyInTotal).toFixed(2)} in · ${cashoutAmount.toFixed(2)} out</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

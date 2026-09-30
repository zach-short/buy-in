'use client';

import { use } from 'react';
import useSWR from 'swr';

import {
  describeNet, formatCents, formatDate, formatTime, isSettled, renderVenmoNote, venmoTxnFor, venmoUrls,
  type NetKind, type SharedTab,
} from '@pb/core';
import { NO_PAY_METHOD } from '@/components/portal/pay-panel';
import { paidLine } from '@/components/settle/net-copy';
import { StatusScreen } from '@/components/shared/status-screen';
import { sharedBalanceCents, sharedNightNet } from '@/lib/ledger';
import { fetchSharedTab } from '@/lib/supabase/public';
import { openVenmo } from '@/lib/venmo';

function byCreatedAt(a: { created_at: string }, b: { created_at: string }): number {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

// Every session any row points at — not only tab.sessions entries with a drink or buy-in —
// so a night whose only row is a tagged payment, or whose session the RPC did not describe,
// is listed rather than counted in the balance and missing here (as portal/night-history.tsx
// does). Newest first; played_on is a date, so ISO strings sort, and undescribed nights sort
// last. Every row is already this player's. A night's net counts every cash-out and the
// payments tagged with that night; payments with no night are in the running balance only,
// so a night can read "you owed" after it was paid.
function sessionIdsWithRows(tab: SharedTab): string[] {
  const ids = new Set<string>();
  for (const rows of [tab.orders, tab.buy_ins, tab.cashouts]) rows.forEach((r) => ids.add(r.session_id));
  tab.payments.forEach((p) => p.session_id && ids.add(p.session_id));
  return [...ids];
}

function sessionGroups(tab: SharedTab) {
  const described = new Map(tab.sessions.map((s) => [s.id, s]));
  return sessionIdsWithRows(tab)
    .map((id) => ({ id, name: described.get(id)?.name ?? 'A night at the table', played_on: described.get(id)?.played_on ?? null }))
    .sort((a, b) => (b.played_on ?? '').localeCompare(a.played_on ?? ''))
    .map((session) => ({
      session,
      sessionOrders: tab.orders.filter((o) => o.session_id === session.id).sort(byCreatedAt),
      sessionBuyIns: tab.buy_ins.filter((b) => b.session_id === session.id),
      sessionCashouts: tab.cashouts.filter((c) => c.session_id === session.id),
      hasPayments: tab.payments.some((p) => p.session_id === session.id),
      night: sharedNightNet(tab, session.id),
    }));
}

const NIGHT_NET_LABEL: Readonly<Record<NetKind, string>> = { owes: 'you owed', owed: 'owed to you', even: 'net' };
const NIGHT_NET_COLOR: Readonly<Record<NetKind, string>> = {
  owes: 'var(--destructive)',
  owed: '#22c55e',
  even: 'var(--muted-foreground)',
};

function VenmoIcon() {
  return (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='white'>
      <path d='M19.07 3C19.82 4.27 20.16 5.58 20.16 7.22C20.16 12.23 15.68 18.72 12.05 22H4.27L1 4.36L8.19 3.67L9.84 15.05C11.42 12.36 13.38 8.19 13.38 5.42C13.38 3.97 13.1 2.97 12.68 2.14L19.07 3Z' />
    </svg>
  );
}

export default function PlayerReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  // A portal-scoped link (D15); the token alone decides whose history this is (§9.1 #7).
  const { data: tab, error, mutate } = useSWR(['shared_tab', token, 'portal'], ([, t]) => fetchSharedTab(t, 'portal'));

  if (error) {
    return (
      <StatusScreen
        kind='error'
        title='Invalid link'
        message='This link may be outdated. Ask for a new one.'
        action={{ label: 'Try again', onClick: () => void mutate() }}
        secondaryAction={{ label: 'Go to Buy-In', href: '/' }}
      />
    );
  }

  if (!tab) return <StatusScreen kind='loading' />;

  const { player } = tab;
  const balanceCents = sharedBalanceCents(tab);
  const groups = sessionGroups(tab);
  // The host's handle from bars (D6), not NEXT_PUBLIC_VENMO_HANDLE. Pay when the player owes,
  // charge the host when the host owes — the direction this page always had. The note is the
  // host's template, plain "Buy-In" by default, never the amount unless the template asks
  // (owner, 2026-09-27; 0003).
  const handle = tab.bar.venmo_handle;
  const note = renderVenmoNote(tab.bar.venmo_note_template, { amountCents: balanceCents });
  // This page offers Venmo only, but a Cash App handle is still a way to pay, so it is not "none".
  const noPayMethod = balanceCents > 0 && !handle && !tab.bar.cashapp_handle;

  function handleVenmo() {
    if (!handle) return;
    openVenmo(venmoUrls(handle, balanceCents, note, venmoTxnFor(balanceCents)));
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
        .pr-wrap {
          min-height: 100dvh;
          padding: 2.5rem 1.25rem 4rem;
          max-width: 420px;
          margin: 0 auto;
          font-family: 'Courier Prime', 'Courier New', monospace;
        }
        .pr-header { margin-bottom: 1.5rem; }
        .pr-venue {
          font-size: 0.6875rem;
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
          font-size: 0.6875rem;
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
          font-size: 0.6875rem;
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
          min-height: 44px;
          padding: 0.7rem 1rem;
          background: #3D95CE;
          color: #fff;
          border: none;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          font-family: inherit;
        }
        .pr-section-label {
          font-size: 0.6875rem;
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
        .pr-session-date { font-size: 0.6875rem; color: var(--muted-foreground); margin-top: 0.1rem; }
        .pr-session-net { font-size: 0.8rem; font-weight: 700; text-align: right; }
        .pr-session-net-label { font-size: 0.6875rem; color: var(--muted-foreground); text-align: right; margin-top: 0.1rem; }
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
        .pr-row-time { font-size: 0.6875rem; color: var(--muted-foreground); margin-left: 0.3rem; opacity: 0.7; }
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
        .pr-no-pay {
          font-size: 0.75rem;
          color: var(--muted-foreground);
          margin-bottom: 1rem;
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
          <p className='pr-venue'>Buy-In</p>
          <p className='pr-name'>{player.name}</p>
        </div>

        <div className='pr-balance-card'>
          <div>
            <p className='pr-balance-label'>Running Balance</p>
            {isSettled(balanceCents) ? (
              <p className='pr-balance-amount' style={{ color: 'var(--muted-foreground)', fontSize: '1.1rem' }}>All settled up</p>
            ) : (
              <>
                <p className='pr-balance-amount' style={{ color: balanceCents > 0 ? 'var(--destructive)' : '#22c55e' }}>
                  ${formatCents(Math.abs(balanceCents))}
                </p>
                <p className='pr-balance-sub'>{balanceCents > 0 ? 'you owe' : 'owed to you'}</p>
              </>
            )}
          </div>
          {handle && !isSettled(balanceCents) && (
            <button onClick={handleVenmo} className='pr-venmo-btn'>
              <VenmoIcon />
              {balanceCents > 0 ? 'Pay' : 'Request'}
            </button>
          )}
        </div>

        {noPayMethod && <p className='pr-no-pay'>{NO_PAY_METHOD}</p>}

        <p className='pr-section-label'>Session History</p>

        {groups.length === 0 ? (
          <p className='pr-empty'>No history yet</p>
        ) : (
          groups.map(({ session, sessionOrders, sessionBuyIns, sessionCashouts, hasPayments, night }) => {
            const net = describeNet(night.netCents);
            const paid = paidLine(night.paidCents, 'player');
            return (
              <div key={session.id} className='pr-session'>
                <div className='pr-session-head'>
                  <div>
                    <p className='pr-session-name'>{session.name}</p>
                    {session.played_on && <p className='pr-session-date'>{formatDate(session.played_on)}</p>}
                  </div>
                  <div>
                    <p className='pr-session-net' style={{ color: NIGHT_NET_COLOR[net.kind] }}>
                      {net.kind === 'even' ? 'Even' : `$${formatCents(net.amountCents)}`}
                    </p>
                    <p className='pr-session-net-label'>{NIGHT_NET_LABEL[net.kind]}</p>
                  </div>
                </div>
                <div className='pr-session-body'>
                  {sessionBuyIns.map((b, i) => (
                    <div key={b.id} className='pr-row'>
                      <span className='pr-row-name'>{i === 0 ? 'Buy-in' : 'Re-buy'}</span>
                      <span className='pr-row-amount'>+${formatCents(b.amount_cents)}</span>
                    </div>
                  ))}
                  {sessionOrders.map((o) => (
                    <div key={o.id} className='pr-row'>
                      <span className='pr-row-name'>
                        {o.drink_name}
                        <span className='pr-row-time'>{formatTime(o.created_at)}</span>
                      </span>
                      <span className='pr-row-amount'>+${formatCents(o.price_cents)}</span>
                    </div>
                  ))}
                  {sessionCashouts.map((c) => (
                    <div key={c.id} className='pr-row pr-cashout'>
                      <span className='pr-row-name'>Cashout</span>
                      <span className='pr-row-amount'>−${formatCents(c.amount_cents)}</span>
                    </div>
                  ))}
                  {hasPayments && (
                    <div className='pr-row'>
                      <span className='pr-row-name'>{paid.label}</span>
                      <span className='pr-row-amount'>{paid.amount}</span>
                    </div>
                  )}
                  <div className='pr-total-row'>
                    <span>Session total</span>
                    <span>${formatCents(night.drinksCents + night.buyInsCents)} in · ${formatCents(night.cashoutsCents)} out</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

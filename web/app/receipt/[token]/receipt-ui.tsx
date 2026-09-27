'use client';

import { use } from 'react';
import useSWR from 'swr';

import { formatCents, formatDate, formatTime, renderVenmoNote, VENMO_NOTE_PREFIX, venmoUrls } from '@pb/core';
import { sumCents } from '@/lib/ledger';
import { fetchSharedTab } from '@/lib/supabase/public';
import { openVenmo } from '@/lib/venmo';

function byCreatedAt(a: { created_at: string }, b: { created_at: string }): number {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export default function PublicReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  // A session-scoped link (D15): every row in it is this player's, for this one night, so
  // nothing is filtered here — the RPC already did it.
  const { data: tab, error } = useSWR(['shared_tab', token, 'session'], ([, t]) => fetchSharedTab(t, 'session'));

  if (!tab && !error) {
    return (
      <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
        Loading…
      </div>
    );
  }

  const session = tab?.sessions[0];
  const player = tab?.player;

  if (!tab || !session || !player) {
    return (
      <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
        Receipt not found
      </div>
    );
  }

  const playerOrders = [...tab.orders].sort(byCreatedAt);
  const playerBuyIns = [...tab.buy_ins].sort(byCreatedAt);
  const playerCashout = tab.cashouts[0];

  const cashoutCents = playerCashout?.amount_cents ?? 0;
  const totalCents =
    sumCents(playerOrders, (o) => o.price_cents) + sumCents(playerBuyIns, (b) => b.amount_cents) - cashoutCents;

  // The host's handle from bars (D6), not an env var. The note is the host's template (0003,
  // owner 2026-09-27); with none set, a night's receipt keeps D12's `Buy-In — <session>`.
  // Offered only when the player owes: the Go-era button sent a negative amount to Venmo.
  const handle = tab.bar.venmo_handle;
  const template = tab.bar.venmo_note_template ?? `${VENMO_NOTE_PREFIX} — {{session}}`;
  const note = renderVenmoNote(template, { amountCents: totalCents, sessionName: session.name });
  const venmo = handle && totalCents > 0 ? venmoUrls(handle, totalCents, note) : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');

        .receipt-wrap {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 1.5rem;
          gap: 1.25rem;
        }

        .receipt-card {
          width: 100%;
          max-width: 340px;
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 2rem 1.75rem;
          font-family: 'Courier Prime', 'Courier New', monospace;
        }

        .r-venue {
          text-align: center;
          font-size: 0.65rem;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--muted-foreground);
          margin-bottom: 0.2rem;
        }

        .r-name {
          text-align: center;
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--primary);
          margin-bottom: 0.15rem;
        }

        .r-date {
          text-align: center;
          font-size: 0.65rem;
          color: var(--muted-foreground);
          letter-spacing: 0.08em;
          margin-bottom: 1.5rem;
        }

        .r-divider {
          border: none;
          border-top: 1px dashed var(--border);
          margin: 0.85rem 0;
        }

        .r-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 0.5rem;
          font-size: 0.8rem;
          margin-bottom: 0.45rem;
          color: var(--foreground);
        }

        .r-time {
          font-size: 0.65rem;
          color: var(--muted-foreground);
          min-width: 50px;
          flex-shrink: 0;
        }

        .r-drink {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .r-price {
          font-weight: 700;
          flex-shrink: 0;
        }

        .r-total {
          display: flex;
          justify-content: space-between;
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--primary);
        }

        .r-footer {
          text-align: center;
          font-size: 0.6rem;
          color: var(--muted-foreground);
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-top: 1.25rem;
        }

        .venmo-btn {
          width: 100%;
          max-width: 340px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          padding: 1rem;
          background: #3D95CE;
          color: #fff;
          border: none;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: pointer;
          text-decoration: none;
          transition: opacity 0.15s;
        }

        .venmo-btn:active { opacity: 0.8; }

        .venmo-amount {
          font-size: 1rem;
          font-weight: 700;
        }

        @media print {
          @page { margin: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .venmo-btn { display: none !important; }
          .receipt-wrap { justify-content: flex-start; padding: 1rem; }
        }
      `}</style>

      <div className='receipt-wrap'>
        <div className='receipt-card'>
          <p className='r-venue'>Buy-In</p>
          <p className='r-name'>{player.name}</p>
          <p className='r-date'>
            {formatDate(session.played_on)} · {session.name}
          </p>

          <hr className='r-divider' />

          {playerBuyIns.map((b, i) => (
            <div key={b.id} className='r-row'>
              <span className='r-time' />
              <span className='r-drink'>{i === 0 ? 'Buy-in' : 'Re-buy'}</span>
              <span className='r-price'>+${formatCents(b.amount_cents)}</span>
            </div>
          ))}

          {playerOrders.map((order) => (
            <div key={order.id} className='r-row'>
              <span className='r-time'>{formatTime(order.created_at)}</span>
              <span className='r-drink'>{order.drink_name}</span>
              <span className='r-price'>+${formatCents(order.price_cents)}</span>
            </div>
          ))}

          {playerCashout && (
            <div className='r-row' style={{ color: '#22c55e' }}>
              <span className='r-time' />
              <span className='r-drink'>Cash out</span>
              <span className='r-price'>−${formatCents(cashoutCents)}</span>
            </div>
          )}

          {playerOrders.length === 0 && playerBuyIns.length === 0 && (
            <p
              style={{
                textAlign: 'center',
                fontSize: '0.75rem',
                color: 'var(--muted-foreground)',
                padding: '0.75rem 0',
              }}
            >
              No activity
            </p>
          )}

          <hr className='r-divider' />

          <div className='r-total'>
            <span>Total owed</span>
            <span>${formatCents(totalCents)}</span>
          </div>

          <p className='r-footer'>Good game</p>
        </div>

        {venmo && (
          <button onClick={() => openVenmo(venmo)} className='venmo-btn'>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='white'>
              <path d='M19.07 3C19.82 4.27 20.16 5.58 20.16 7.22C20.16 12.23 15.68 18.72 12.05 22H4.27L1 4.36L8.19 3.67L9.84 15.05C11.42 12.36 13.38 8.19 13.38 5.42C13.38 3.97 13.1 2.97 12.68 2.14L19.07 3Z' />
            </svg>
            Pay on Venmo
            <span className='venmo-amount'>${formatCents(totalCents)}</span>
          </button>
        )}

      </div>
    </>
  );
}

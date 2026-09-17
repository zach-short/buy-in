'use client';

import { use } from 'react';
import useSWR from 'swr';
import { fetcher, formatDate, formatTime, Session, Player, Order, BuyIn, Cashout } from '@/lib/bar-api';

export default function PublicReceiptPage({
  params,
}: {
  params: Promise<{ sessionId: string; playerId: string }>;
}) {
  const { sessionId, playerId } = use(params);

  const { data: portalData } = useSWR<{ token: string }>(
    `/api/players/${playerId}/portal-token`,
    fetcher,
  );
  const portalUrl = portalData ? `/portal/${playerId}/${portalData.token}` : null;
  const { data: sessions = [] } = useSWR<Session[]>('/api/sessions', fetcher);
  const session = sessions.find((s) => s.id === sessionId);

  const { data: players = [] } = useSWR<Player[]>('/api/players', fetcher);
  const player = players.find((p) => p.id === playerId);

  const { data: orders = [] } = useSWR<Order[]>(
    `/api/orders?sessionId=${sessionId}`,
    fetcher,
  );
  const { data: buyIns = [] } = useSWR<BuyIn[]>(
    `/api/buyins?sessionId=${sessionId}`,
    fetcher,
  );
  const { data: cashouts = [] } = useSWR<Cashout[]>(
    `/api/cashouts?sessionId=${sessionId}`,
    fetcher,
  );

  const playerOrders = orders
    .filter((o) => o.playerId === playerId)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  const playerBuyIns = buyIns
    .filter((b) => b.playerId === playerId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const playerCashout = cashouts.find((c) => c.playerId === playerId);

  const drinkTotal = playerOrders.reduce((s, o) => s + o.price, 0);
  const buyInTotal = playerBuyIns.reduce((s, b) => s + b.amount, 0);
  const cashoutAmount = playerCashout?.amount ?? 0;
  const total = drinkTotal + buyInTotal - cashoutAmount;

  const venmoNote = encodeURIComponent(`${session?.name ?? ''}`);
  const venmoRecipient = process.env.NEXT_PUBLIC_VENMO_HANDLE?.replace(
    /^@/,
    '',
  );
  const venmoDeepLink = venmoRecipient
    ? `venmo://paycharge?txn=pay&recipients=${venmoRecipient}&amount=${total.toFixed(2)}&note=${venmoNote}`
    : null;
  const venmoWebUrl = venmoRecipient
    ? `https://account.venmo.com/pay?recipients=${venmoRecipient}&amount=${total.toFixed(2)}&note=${venmoNote}`
    : null;

  function handleVenmo() {
    if (!venmoDeepLink || !venmoWebUrl) return;
    window.location.href = venmoDeepLink;
    setTimeout(() => {
      if (!document.hidden) window.location.href = venmoWebUrl;
    }, 1500);
  }

  const isLoading = sessions.length === 0 || players.length === 0;

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
        Loading…
      </div>
    );
  }

  if (!session || !player) {
    return (
      <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
        Receipt not found
      </div>
    );
  }

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
          <p className='r-venue'>Poker Bar</p>
          <p className='r-name'>{player.name}</p>
          <p className='r-date'>
            {formatDate(session.date)} · {session.name}
          </p>

          <hr className='r-divider' />

          {playerBuyIns.map((b, i) => (
            <div key={b.id} className='r-row'>
              <span className='r-time' />
              <span className='r-drink'>{i === 0 ? 'Buy-in' : 'Re-buy'}</span>
              <span className='r-price'>+${b.amount.toFixed(2)}</span>
            </div>
          ))}

          {playerOrders.map((order) => (
            <div key={order.id} className='r-row'>
              <span className='r-time'>{formatTime(order.timestamp)}</span>
              <span className='r-drink'>{order.drinkName}</span>
              <span className='r-price'>+${order.price.toFixed(2)}</span>
            </div>
          ))}

          {playerCashout && (
            <div className='r-row' style={{ color: '#22c55e' }}>
              <span className='r-time' />
              <span className='r-drink'>Cash out</span>
              <span className='r-price'>−${cashoutAmount.toFixed(2)}</span>
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
            <span>${total.toFixed(2)}</span>
          </div>

          <p className='r-footer'>Good game</p>
        </div>

        {venmoDeepLink && (
          <button onClick={handleVenmo} className='venmo-btn'>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='white'>
              <path d='M19.07 3C19.82 4.27 20.16 5.58 20.16 7.22C20.16 12.23 15.68 18.72 12.05 22H4.27L1 4.36L8.19 3.67L9.84 15.05C11.42 12.36 13.38 8.19 13.38 5.42C13.38 3.97 13.1 2.97 12.68 2.14L19.07 3Z' />
            </svg>
            Pay on Venmo
            <span className='venmo-amount'>${total.toFixed(2)}</span>
          </button>
        )}

        {portalUrl && (
          <a
            href={portalUrl}
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--muted-foreground)',
              textDecoration: 'none',
              marginTop: '0.5rem',
            }}
          >
            ← My Account
          </a>
        )}
      </div>
    </>
  );
}

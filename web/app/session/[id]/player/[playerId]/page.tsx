'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, formatDate, formatTime, Session, Player, Order, BuyIn, Cashout } from '@/lib/bar-api';
import { Printer, Share2, MessageCircle } from 'lucide-react';

export default function PlayerReceiptPage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}) {
  const { id, playerId } = use(params);
  const router = useRouter();

  const { data: sessions = [] } = useSWR<Session[]>('/api/sessions', fetcher);
  const session = sessions.find((s) => s.id === id);

  const { data: players = [] } = useSWR<Player[]>('/api/players', fetcher);
  const player = players.find((p) => p.id === playerId);

  const { data: orders = [] } = useSWR<Order[]>(
    `/api/orders?sessionId=${id}`,
    fetcher,
  );
  const { data: buyIns = [] } = useSWR<BuyIn[]>(
    `/api/buyins?sessionId=${id}`,
    fetcher,
  );
  const { data: cashouts = [] } = useSWR<Cashout[]>(
    `/api/cashouts?sessionId=${id}`,
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

  function handlePrint() {
    window.print();
  }

  function handleShare() {
    const url = `${window.location.origin}/receipt/${id}/${playerId}`;
    const body = encodeURIComponent(url);

    if (player?.phone) {
      window.location.href = `sms:${player.phone}&body=${body}`;
    } else if (navigator.share) {
      navigator
        .share({ title: `${player?.name} Receipt`, url })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard');
    }
  }

  if (!session || !player) {
    return (
      <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
        Loading…
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');

        .receipt-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 1.5rem 8rem;
        }

        .receipt-toolbar {
          width: 100%;
          max-width: 360px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
        }

        .receipt-card {
          width: 100%;
          max-width: 360px;
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 2rem 1.75rem;
          font-family: 'Courier Prime', 'Courier New', monospace;
        }

        .receipt-venue {
          text-align: center;
          font-size: 0.7rem;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--muted-foreground);
          margin-bottom: 0.25rem;
        }

        .receipt-title {
          text-align: center;
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--primary);
          margin-bottom: 0.15rem;
        }

        .receipt-date {
          text-align: center;
          font-size: 0.65rem;
          color: var(--muted-foreground);
          letter-spacing: 0.1em;
          margin-bottom: 1.5rem;
        }

        .receipt-divider {
          border: none;
          border-top: 1px dashed var(--border);
          margin: 1rem 0;
        }

        .receipt-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 0.5rem;
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
          color: var(--foreground);
        }

        .receipt-row-time {
          font-size: 0.65rem;
          color: var(--muted-foreground);
          min-width: 52px;
          flex-shrink: 0;
        }

        .receipt-row-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .receipt-row-price {
          font-weight: 700;
          flex-shrink: 0;
        }

        .receipt-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--primary);
          margin-top: 0.25rem;
        }

        .receipt-footer {
          text-align: center;
          font-size: 0.6rem;
          color: var(--muted-foreground);
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-top: 1.5rem;
        }

        .action-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 1rem 1.5rem;
          display: flex;
          gap: 0.75rem;
          background: var(--background);
          border-top: 1px solid var(--border);
        }

        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 4px;
          font-size: 0.7rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: opacity 0.15s;
        }

        .action-btn:active { opacity: 0.7; }

        .action-btn-primary {
          background: var(--primary);
          color: var(--primary-foreground);
        }

        .action-btn-outline {
          background: transparent;
          color: var(--foreground);
          border: 1px solid var(--border);
        }

        @media print {
          @page { margin: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .receipt-toolbar, .action-bar { display: none !important; }
          .receipt-page { padding: 1rem; justify-content: flex-start; }
        }
      `}</style>

      <div className='receipt-page'>
        <div className='receipt-toolbar'>
          <button
            onClick={() => router.back()}
            className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
          >
            ← Back
          </button>
        </div>

        <div className='receipt-card'>
          <p className='receipt-venue'>Poker Bar</p>
          <p className='receipt-title'>{player.name}</p>
          <p className='receipt-date'>
            {formatDate(session.date)} · {session.name}
          </p>
          <hr className='receipt-divider' />
          {playerBuyIns.map((b, i) => (
            <div key={b.id} className='receipt-row'>
              <span className='receipt-row-time' />
              <span className='receipt-row-name'>{i === 0 ? 'Buy-in' : 'Re-buy'}</span>
              <span className='receipt-row-price'>+${b.amount.toFixed(2)}</span>
            </div>
          ))}
          {playerOrders.length === 0 && playerBuyIns.length === 0 ? (
            <p
              style={{
                textAlign: 'center',
                fontSize: '0.75rem',
                color: 'var(--muted-foreground)',
                padding: '1rem 0',
              }}
            >
              No activity
            </p>
          ) : (
            playerOrders.map((order) => (
              <div key={order.id} className='receipt-row'>
                <span className='receipt-row-time'>
                  {formatTime(order.timestamp)}
                </span>
                <span className='receipt-row-name'>{order.drinkName}</span>
                <span className='receipt-row-price'>
                  +${order.price.toFixed(2)}
                </span>
              </div>
            ))
          )}
          {playerCashout && (
            <div className='receipt-row' style={{ color: 'var(--muted-foreground)' }}>
              <span className='receipt-row-time' />
              <span className='receipt-row-name'>Cash out</span>
              <span className='receipt-row-price' style={{ color: '#22c55e' }}>
                −${cashoutAmount.toFixed(2)}
              </span>
            </div>
          )}
          <hr className='receipt-divider' />
          <div className='receipt-total-row'>
            <span>Total owed</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <p className='receipt-footer'>Thank you · Good game</p>
        </div>
      </div>

      <div className='action-bar'>
        <button className='action-btn action-btn-outline' onClick={handleShare}>
          {player.phone ? <MessageCircle size={14} /> : <Share2 size={14} />}
          {player.phone ? 'Text' : 'Share'}
        </button>
        <button className='action-btn action-btn-primary' onClick={handlePrint}>
          <Printer size={14} />
          Save PDF
        </button>
      </div>
    </>
  );
}

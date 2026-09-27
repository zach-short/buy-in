'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { formatCents, formatDate, formatTime } from '@pb/core';
import { sumCents } from '@/lib/ledger';
import {
  fetchPlayers, fetchSessionBuyIns, fetchSessionCashouts, fetchSessionOrders, fetchSessions,
} from '@/lib/supabase/queries';
import { receiptUrl, shareToken } from '@/lib/supabase/share-links';
import { Printer, Share2, MessageCircle } from 'lucide-react';

export default function PlayerReceiptPage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}) {
  const { id, playerId } = use(params);
  const router = useRouter();

  const { data: sessions = [] } = useSWR('sessions', fetchSessions);
  const session = sessions.find((s) => s.id === id);

  const { data: players = [] } = useSWR('players', fetchPlayers);
  const player = players.find((p) => p.id === playerId);

  const { data: orders = [] } = useSWR(
    ['orders', id],
    ([, sessionId]) => fetchSessionOrders(sessionId),
  );
  const { data: buyIns = [] } = useSWR(
    ['buy_ins', id],
    ([, sessionId]) => fetchSessionBuyIns(sessionId),
  );
  const { data: cashouts = [] } = useSWR(
    ['cashouts', id],
    ([, sessionId]) => fetchSessionCashouts(sessionId),
  );

  const playerOrders = orders
    .filter((o) => o.player_id === playerId)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  const playerBuyIns = buyIns
    .filter((b) => b.player_id === playerId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const playerCashout = cashouts.find((c) => c.player_id === playerId);

  const drinkTotalCents = sumCents(playerOrders, (o) => o.price_cents);
  const buyInTotalCents = sumCents(playerBuyIns, (b) => b.amount_cents);
  const cashoutCents = playerCashout?.amount_cents ?? 0;
  const totalCents = drinkTotalCents + buyInTotalCents - cashoutCents;

  function handlePrint() {
    window.print();
  }

  // A session-scoped link (D15), reused if one is live, so sharing twice sends one link.
  async function handleShare() {
    if (!player) return;
    let url: string;
    try {
      url = receiptUrl(await shareToken(player, id));
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
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
          <p className='receipt-venue'>Buy-In</p>
          <p className='receipt-title'>{player.name}</p>
          <p className='receipt-date'>
            {formatDate(session.played_on)} · {session.name}
          </p>
          <hr className='receipt-divider' />
          {playerBuyIns.map((b, i) => (
            <div key={b.id} className='receipt-row'>
              <span className='receipt-row-time' />
              <span className='receipt-row-name'>{i === 0 ? 'Buy-in' : 'Re-buy'}</span>
              <span className='receipt-row-price'>+${formatCents(b.amount_cents)}</span>
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
                  {formatTime(order.created_at)}
                </span>
                <span className='receipt-row-name'>{order.drink_name}</span>
                <span className='receipt-row-price'>
                  +${formatCents(order.price_cents)}
                </span>
              </div>
            ))
          )}
          {playerCashout && (
            <div className='receipt-row' style={{ color: 'var(--muted-foreground)' }}>
              <span className='receipt-row-time' />
              <span className='receipt-row-name'>Cash out</span>
              <span className='receipt-row-price' style={{ color: '#22c55e' }}>
                −${formatCents(cashoutCents)}
              </span>
            </div>
          )}
          <hr className='receipt-divider' />
          <div className='receipt-total-row'>
            <span>Total owed</span>
            <span>${formatCents(totalCents)}</span>
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

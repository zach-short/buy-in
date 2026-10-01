'use client';

import { use } from 'react';
import useSWR from 'swr';
import { formatCents, formatDate, formatTime } from '@pb/core';
import { netParts, paidLine } from '@/components/settle/net-copy';
import { sendReceipt } from '@/components/settle/send-receipt';
import { BackAction } from '@/components/shared/layout/back-action';
import { StatusScreen } from '@/components/shared/status-screen';
import { useGoBack } from '@/hooks/use-go-back';
import { courierPrime } from '@/lib/fonts';
import { nightNetFromRows } from '@/lib/ledger';
import {
  fetchPlayerPayments, fetchPlayers, fetchSessionBuyIns, fetchSessionCashouts, fetchSessionOrders, fetchSessions,
} from '@/lib/supabase/queries';
import { Printer, Share2, MessageCircle } from 'lucide-react';

export default function PlayerReceiptPage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}) {
  const { id, playerId } = use(params);
  const goBack = useGoBack('/sessions');

  const sessionsRead = useSWR('sessions', fetchSessions);
  const sessions = sessionsRead.data ?? [];
  const session = sessions.find((s) => s.id === id);

  const playersRead = useSWR('players', fetchPlayers);
  const players = playersRead.data ?? [];
  const player = players.find((p) => p.id === playerId);

  const ordersRead = useSWR(
    ['orders', id],
    ([, sessionId]) => fetchSessionOrders(sessionId),
  );
  const buyInsRead = useSWR(
    ['buy_ins', id],
    ([, sessionId]) => fetchSessionBuyIns(sessionId),
  );
  const cashoutsRead = useSWR(
    ['cashouts', id],
    ([, sessionId]) => fetchSessionCashouts(sessionId),
  );
  // The player page's key. Only payments settle-up tagged with this night count on its receipt.
  const paymentsRead = useSWR(
    ['payments', playerId],
    ([, pid]) => fetchPlayerPayments(pid),
  );
  const orders = ordersRead.data ?? [];
  const buyIns = buyInsRead.data ?? [];
  const cashouts = cashoutsRead.data ?? [];
  const payments = paymentsRead.data ?? [];

  // Every read the receipt is drawn from. Until all have data the net would be summed over
  // empty lists, a $0 and "No activity" that look like a real answer; and a failed read would
  // leave it that way. So loading and failure show their own screens, and Try again re-runs
  // only the reads that failed.
  const reads = [sessionsRead, playersRead, ordersRead, buyInsRead, cashoutsRead, paymentsRead];
  const failed = reads.filter((read) => read.error !== undefined);
  const waiting = reads.some((read) => read.data === undefined);

  const playerOrders = orders
    .filter((o) => o.player_id === playerId)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  const playerBuyIns = buyIns
    .filter((b) => b.player_id === playerId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const playerCashouts = cashouts.filter((c) => c.player_id === playerId);
  const nightPayments = payments.filter((p) => p.session_id === id);

  const night = nightNetFromRows(playerId, orders, buyIns, cashouts, nightPayments);
  const total = netParts(night.netCents, 'player');
  const paid = paidLine(night.paidCents, 'player');

  function handlePrint() {
    window.print();
  }

  if (failed.length) {
    return (
      <StatusScreen
        kind='error'
        title='Couldn’t load this receipt'
        message={errorMessage(failed[0].error)}
        action={{ label: 'Try again', onClick: () => failed.forEach((read) => void read.mutate()) }}
        secondaryAction={{ label: 'Back', onClick: goBack }}
      />
    );
  }
  if (waiting) return <StatusScreen kind='loading' />;
  if (!session || !player) {
    return <StatusScreen kind='error' title='Receipt not found' action={{ label: 'Back', onClick: goBack }} />;
  }

  return (
    <>
      <style>{`
        .receipt-page {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 1.5rem calc(8rem + env(safe-area-inset-bottom));
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
          padding: 1rem 1.5rem calc(1rem + env(safe-area-inset-bottom));
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
          min-height: 44px;
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
          <BackAction fallback='/sessions' />
        </div>

        <div className={`receipt-card ${courierPrime.className}`}>
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
          {playerCashouts.map((c) => (
            <div key={c.id} className='receipt-row' style={{ color: 'var(--muted-foreground)' }}>
              <span className='receipt-row-time' />
              <span className='receipt-row-name'>Cash out</span>
              <span className='receipt-row-price' style={{ color: '#22c55e' }}>
                −${formatCents(c.amount_cents)}
              </span>
            </div>
          ))}
          {nightPayments.length > 0 && (
            <div className='receipt-row' style={{ color: 'var(--muted-foreground)' }}>
              <span className='receipt-row-time' />
              <span className='receipt-row-name'>{paid.label}</span>
              <span className='receipt-row-price'>{paid.amount}</span>
            </div>
          )}
          <hr className='receipt-divider' />
          <div className='receipt-total-row'>
            <span>{total.label}</span>
            {total.amount && <span>{total.amount}</span>}
          </div>
          <p className='receipt-footer'>Thank you · Good game</p>
        </div>
      </div>

      <div className='action-bar'>
        <button className='action-btn action-btn-outline' onClick={() => void sendReceipt(player, id)}>
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

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

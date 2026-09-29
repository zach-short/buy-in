'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { formatCents } from '@pb/core';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { StatusScreen } from '@/components/shared/status-screen';
import { sendReceipt } from '@/components/settle/send-receipt';
import { SettleUp } from '@/components/settle/settle-up';
import { sumCents } from '@/lib/ledger';
import {
  fetchPayments, fetchPlayers, fetchSessionBuyIns, fetchSessionCashouts, fetchSessionOrders, fetchSessions,
  type PlayerRow,
} from '@/lib/supabase/queries';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

export default function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const sessionsQuery = useSWR('sessions', fetchSessions);
  const playersQuery = useSWR('players', fetchPlayers);
  const ordersQuery = useSWR(['orders', id], ([, sessionId]) => fetchSessionOrders(sessionId));
  const buyInsQuery = useSWR(['buy_ins', id], ([, sessionId]) => fetchSessionBuyIns(sessionId));
  const cashoutsQuery = useSWR(['cashouts', id], ([, sessionId]) => fetchSessionCashouts(sessionId));
  // Bar-wide, under the same key the players list uses; the night's are the ones settle-up
  // tagged with this session. Untagged payments settle a player's whole balance, not a night.
  const paymentsQuery = useSWR('payments', fetchPayments);

  // Settle-up prefills "Record payment" with the net, so a net computed before every ledger
  // list has arrived (an empty payments list, say) would invite recording a debt twice. The
  // page renders nothing money-shaped until all of them are in; the `?? []` below only
  // satisfies the derivations that run before that gate.
  const queries = [sessionsQuery, playersQuery, ordersQuery, buyInsQuery, cashoutsQuery, paymentsQuery];
  const failed = queries.some((q) => q.error !== undefined);
  const loaded = queries.every((q) => q.data !== undefined);

  const sessions = sessionsQuery.data ?? [];
  const session = sessions.find((s) => s.id === id);
  const players = playersQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const buyIns = buyInsQuery.data ?? [];
  const cashouts = cashoutsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const nightPayments = payments.filter((p) => p.session_id === id);

  const sessionPlayers = players.filter((p) =>
    session?.player_ids.includes(p.id),
  );
  // Anyone with money in the night settles, even if they are no longer at the table.
  const nightPlayerIds = new Set([
    ...sessionPlayers.map((p) => p.id),
    ...[...orders, ...buyIns, ...cashouts, ...nightPayments].map((row) => row.player_id),
  ]);
  const nightPlayers = players.filter((p) => nightPlayerIds.has(p.id));
  const playersWithPhone = sessionPlayers.filter((p) => p.phone);

  const totalRevenueCents = sumCents(orders, (o) => o.price_cents);
  const totalCogsCents = sumCents(orders, (o) => o.cost_estimate_cents);
  const totalProfitCents = totalRevenueCents - totalCogsCents;

  const [textIndex, setTextIndex] = useState<number | null>(null);
  const isDone = textIndex !== null && textIndex >= playersWithPhone.length;
  const current =
    textIndex !== null && !isDone ? playersWithPhone[textIndex] : null;

  function startTexting() {
    setTextIndex(0);
  }

  // A session-scoped link (D15): the text carries this night only, not the player's history.
  async function openText(player: PlayerRow) {
    if (await sendReceipt(player, id)) setTimeout(() => setTextIndex((i) => (i ?? 0) + 1), 500);
  }

  function skip() {
    setTextIndex((i) => (i ?? 0) + 1);
  }

  if (failed) {
    return (
      <StatusScreen
        kind='error'
        title='Could not load this session'
        action={{ label: 'Try again', onClick: () => queries.forEach((q) => void q.mutate()) }}
      />
    );
  }
  if (!loaded) return <StatusScreen kind='loading' />;
  if (!session) {
    return <StatusScreen kind='error' title='Session not found' action={{ label: 'Back to sessions', href: '/sessions' }} />;
  }

  return (
    <PageMain>
      <PageHeader title='Session Complete' subtitle={session?.name} />

      {nightPlayers.length > 0 && (
        <SettleUp
          sessionId={id}
          players={nightPlayers}
          orders={orders}
          buyIns={buyIns}
          cashouts={cashouts}
          payments={nightPayments}
        />
      )}

      <div className='border border-border rounded-md p-5 mb-8'>
        <p className='text-xs tracking-widest uppercase text-muted-foreground mb-4'>
          Bar Totals
        </p>
        <div className='grid grid-cols-3 gap-4 text-center'>
          <div>
            <p className='text-xs text-muted-foreground mb-1'>Revenue</p>
            <p className='text-xl font-semibold text-primary'>
              ${formatCents(totalRevenueCents)}
            </p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground mb-1'>Cost</p>
            <p className='text-xl font-semibold'>${formatCents(totalCogsCents)}</p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground mb-1'>Profit</p>
            <p
              className={`text-xl font-semibold ${totalProfitCents >= 0 ? 'text-primary' : 'text-destructive'}`}
            >
              ${formatCents(totalProfitCents)}
            </p>
          </div>
        </div>
      </div>

      {playersWithPhone.length > 0 && (
        <div className='mb-8'>
          {textIndex === null && (
            <button
              onClick={startTexting}
              className='w-full flex items-center justify-center gap-2 py-3 border border-border rounded text-xs tracking-widest uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors'
            >
              <MessageCircle size={14} />
              Text Receipts ({playersWithPhone.length})
            </button>
          )}

          {current && (
            <div className='border border-primary/50 rounded-md p-5 space-y-4'>
              <div className='flex items-center justify-between'>
                <p className='text-xs tracking-widest uppercase text-muted-foreground'>
                  {textIndex! + 1} of {playersWithPhone.length}
                </p>
                <div className='flex gap-1'>
                  {playersWithPhone.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 w-4 rounded-full ${i <= textIndex! ? 'bg-primary' : 'bg-border'}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className='text-sm font-medium'>{current.name}</p>
                <p className='text-xs text-muted-foreground'>{current.phone}</p>
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={skip}
                  className='flex-1 py-2.5 border border-border rounded text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
                >
                  Skip
                </button>
                <button
                  onClick={() => openText(current)}
                  className='flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded text-xs tracking-widest uppercase font-semibold'
                >
                  <MessageCircle size={13} />
                  Text {current.name}
                </button>
              </div>
            </div>
          )}

          {isDone && (
            <div className='border border-green-500/30 rounded-md p-4 text-center'>
              <p className='text-sm text-green-500 font-medium'>
                All receipts sent
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                {playersWithPhone.length} message
                {playersWithPhone.length > 1 ? 's' : ''} opened
              </p>
            </div>
          )}
        </div>
      )}

      {/* Per-player breakdown */}
      <div className='space-y-4'>
        {sessionPlayers.map((player) => {
          const playerOrders = orders.filter((o) => o.player_id === player.id);
          const subtotalCents = sumCents(playerOrders, (o) => o.price_cents);
          if (playerOrders.length === 0) return null;
          return (
            <div key={player.id} className='border border-border rounded-md'>
              <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
                <span className='text-sm font-medium'>{player.name}</span>
                <div className='flex items-center gap-3'>
                  <span className='text-sm font-semibold text-primary'>
                    ${formatCents(subtotalCents)}
                  </span>
                  <Link
                    href={`/session/${id}/player/${player.id}`}
                    className='text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors border border-border hover:border-primary/50 rounded px-2 py-1'
                  >
                    Receipt
                  </Link>
                </div>
              </div>
              <div className='px-4 py-2 space-y-1.5'>
                {playerOrders.map((order) => (
                  <div
                    key={order.id}
                    className='flex justify-between text-sm py-0.5'
                  >
                    <span className='text-muted-foreground'>
                      {order.drink_name}
                    </span>
                    <span className='tabular-nums'>
                      ${formatCents(order.price_cents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        size='lg'
        className='w-full h-12 text-xs tracking-widest uppercase mt-8'
        onClick={() => router.push('/')}
      >
        Done
      </Button>
    </PageMain>
  );
}

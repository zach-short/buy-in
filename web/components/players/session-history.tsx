import { formatCents, formatDate, formatTime } from '@pb/core';

import { netParts, netText, paidLine } from '@/components/settle/net-copy';
import { nightNetFromRows } from '@/lib/ledger';
import type { BuyInRow, CashoutRow, OrderRow, PaymentRow, SessionWithPlayers } from '@/lib/supabase/queries';

interface LedgerRows {
  sessions: SessionWithPlayers[];
  orders: OrderRow[];
  buyIns: BuyInRow[];
  cashouts: CashoutRow[];
  payments: PaymentRow[];
}

function byTime(a: { created_at: string }, b: { created_at: string }): number {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

type SessionRow = { player_id: string; session_id: string | null };

/** This player's rows by session id, in one pass; input order is kept, so buy-ins stay oldest first. */
function bySession<T extends SessionRow>(rows: readonly T[], playerId: string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (row.player_id !== playerId || row.session_id === null) continue;
    const group = groups.get(row.session_id);
    if (group) group.push(row);
    else groups.set(row.session_id, [row]);
  }
  return groups;
}

/**
 * Each night this player bought in or ordered, newest first. The net is nightNetFromRows over
 * that night's rows and the payments tagged to it, so it matches summary, receipt and portal;
 * a payment with no session counts in the balance and on no night. Each list is grouped by
 * session once, rather than filtered again for every session. Call it inside useMemo.
 */
export function sessionGroupsFor(playerId: string, { sessions, orders, buyIns, cashouts, payments }: LedgerRows) {
  const nightOrders = bySession(orders, playerId);
  const nightBuyIns = bySession(buyIns, playerId);
  const nightCashouts = bySession(cashouts, playerId);
  const nightPayments = bySession(payments, playerId);
  return sessions
    .filter((s) => nightOrders.has(s.id) || nightBuyIns.has(s.id))
    .sort((a, b) => new Date(b.played_on).getTime() - new Date(a.played_on).getTime())
    .map((session) => {
      const sessionOrders = [...(nightOrders.get(session.id) ?? [])].sort(byTime);
      const sessionBuyIns = nightBuyIns.get(session.id) ?? [];
      const night = nightNetFromRows(
        playerId, sessionOrders, sessionBuyIns, nightCashouts.get(session.id) ?? [], nightPayments.get(session.id) ?? [],
      );
      return { session, sessionOrders, sessionBuyIns, night };
    });
}

type SessionGroup = ReturnType<typeof sessionGroupsFor>[number];

const NET_COLOR = { owes: 'text-destructive', owed: 'text-green-500', even: 'text-muted-foreground' } as const;

function SessionCard({ group }: { group: SessionGroup }) {
  const { session, sessionOrders, sessionBuyIns, night } = group;
  const paid = paidLine(night.paidCents, 'host');
  return (
    <div className='border border-border rounded-md'>
      <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
        <div>
          <p className='text-sm font-medium'>{session.name}</p>
          <p className='text-xs text-muted-foreground'>
            {formatDate(session.played_on)}
          </p>
        </div>
        <div className='text-right'>
          <p className={`text-sm font-semibold ${NET_COLOR[netParts(night.netCents, 'host').kind]}`}>
            {netText(night.netCents, 'host')}
          </p>
          <p className='text-xs text-muted-foreground'>this night</p>
        </div>
      </div>

      <div className='px-4 py-3 space-y-1.5 text-sm'>
        {sessionBuyIns.map((b, i) => (
          <div key={b.id} className='flex justify-between text-muted-foreground'>
            <span>{i === 0 ? 'Buy-in' : 'Re-buy'}</span>
            <span className='tabular-nums'>+${formatCents(b.amount_cents)}</span>
          </div>
        ))}
        {sessionOrders.map((order) => (
          <div key={order.id} className='flex justify-between'>
            <span className='text-muted-foreground truncate pr-2'>
              {order.drink_name}{' '}
              <span className='text-xs opacity-60'>{formatTime(order.created_at)}</span>
            </span>
            <span className='tabular-nums shrink-0'>+${formatCents(order.price_cents)}</span>
          </div>
        ))}
        {night.cashoutsCents > 0 && (
          <div className='flex justify-between text-green-500'>
            <span>Cashout</span>
            <span className='tabular-nums'>−${formatCents(night.cashoutsCents)}</span>
          </div>
        )}
        {night.paidCents !== 0 && (
          <div className='flex justify-between text-muted-foreground'>
            <span>{paid.label}</span>
            <span className='tabular-nums'>{paid.amount}</span>
          </div>
        )}
        <div className='flex justify-between font-medium pt-1 border-t border-border mt-1'>
          <span>Session total</span>
          <span className='tabular-nums'>
            ${formatCents(night.drinksCents + night.buyInsCents)} in · $
            {formatCents(night.cashoutsCents)} out
          </span>
        </div>
      </div>
    </div>
  );
}

/** The per-night breakdown on a player's page. Renders nothing when there are no nights. */
export function SessionHistory({ groups }: { groups: SessionGroup[] }) {
  if (!groups.length) return null;
  return (
    <div className='space-y-4 mb-8'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>
        Session History
      </p>
      {groups.map((group) => <SessionCard key={group.session.id} group={group} />)}
    </div>
  );
}

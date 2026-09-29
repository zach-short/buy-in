'use client';

import useSWR from 'swr';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

import { centsToDollars, formatCents } from '@pb/core';
import { DataState } from '@/components/shared/data-state';
import { EmptyResults } from '@/components/results/results-tabs';
import { sumCents } from '@/lib/ledger';
import { fetchOrders, fetchSessions, type OrderRow, type SessionWithPlayers } from '@/lib/supabase/queries';

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function shortDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// revenue/cost/profit/cumProfit are dollars because recharts plots them and picks its own
// axis ticks from them — its nice-tick step is not scale-invariant, so plotting cents would
// change the `$${v}` tick labels. Every sum is taken in cents first (below); the dollar
// values exist only for the chart and its tooltips.
interface SessionStat {
  name: string;
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  cumProfit: number;
}

interface BarTotals {
  stats: SessionStat[];
  revenueCents: number;
  costCents: number;
  profitCents: number;
}

// One pass over the orders, so a long history does not rescan every order per night.
function ordersBySession(orders: readonly OrderRow[]): Map<string, OrderRow[]> {
  const bySession = new Map<string, OrderRow[]>();
  for (const order of orders) {
    const group = bySession.get(order.session_id);
    if (group) group.push(order);
    else bySession.set(order.session_id, [order]);
  }
  return bySession;
}

function closedOldestFirst(sessions: readonly SessionWithPlayers[]): SessionWithPlayers[] {
  return sessions
    .filter((s) => s.status === 'closed')
    .sort((a, b) => new Date(a.played_on).getTime() - new Date(b.played_on).getTime());
}

function toBarTotals(closed: readonly SessionWithPlayers[], orders: readonly OrderRow[]): BarTotals {
  const bySession = ordersBySession(orders);
  const totals: BarTotals = { stats: [], revenueCents: 0, costCents: 0, profitCents: 0 };
  for (const s of closed) {
    const sessionOrders = bySession.get(s.id) ?? [];
    const revenueCents = sumCents(sessionOrders, (o) => o.price_cents);
    const costCents = sumCents(sessionOrders, (o) => o.cost_estimate_cents);
    totals.revenueCents += revenueCents;
    totals.costCents += costCents;
    totals.profitCents += revenueCents - costCents;
    totals.stats.push({
      name: s.name,
      date: shortDate(s.played_on),
      revenue: centsToDollars(revenueCents),
      cost: centsToDollars(costCents),
      profit: centsToDollars(revenueCents - costCents),
      cumProfit: centsToDollars(totals.profitCents),
    });
  }
  return totals;
}

function CumTooltip({ active, payload }: { active?: boolean; payload?: { payload: SessionStat }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className='bg-background border border-border rounded px-3 py-2 text-xs shadow-md'>
      <p className='font-semibold text-primary mb-1'>{d.name}</p>
      <p className='text-muted-foreground'>{d.date}</p>
      <p className='mt-1'>Cumulative profit: <span className={`font-bold ${d.cumProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(d.cumProfit)}</span></p>
      <p>Night profit: <span className='font-medium'>{fmt(d.profit)}</span></p>
    </div>
  );
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; fill: string }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className='bg-background border border-border rounded px-3 py-2 text-xs shadow-md'>
      {payload.map((p) => (
        <p key={p.name}>
          {p.name}: <span className='font-medium' style={{ color: p.fill }}>{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function StatGrid({ items, className }: { items: { label: string; value: string; color: string }[]; className: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {items.map(({ label, value, color }) => (
        <div key={label} className='border border-border rounded-md p-4'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-1'>{label}</p>
          <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function MoneySummary({ totals }: { totals: BarTotals }) {
  const { revenueCents, costCents, profitCents } = totals;
  const margin = revenueCents > 0 ? (profitCents / revenueCents) * 100 : 0;
  return (
    <StatGrid
      className='mb-3 sm:grid-cols-4'
      items={[
        { label: 'Revenue', value: `$${formatCents(revenueCents)}`, color: 'text-foreground' },
        { label: 'Cost', value: `$${formatCents(costCents)}`, color: 'text-muted-foreground' },
        { label: 'Profit', value: `$${formatCents(profitCents)}`, color: profitCents >= 0 ? 'text-primary' : 'text-destructive' },
        { label: 'Margin', value: `${margin.toFixed(1)}%`, color: margin >= 0 ? 'text-primary' : 'text-destructive' },
      ]}
    />
  );
}

// Only what fetchSessions already carries. An average buy-in pot would need every buy_ins row,
// a query this page does not make, so it is left out rather than fetched for one number.
function NightsSummary({ closed }: { closed: readonly SessionWithPlayers[] }) {
  const avgPlayers = closed.reduce((n, s) => n + s.player_ids.length, 0) / closed.length;
  return (
    <StatGrid
      className='mb-10'
      items={[
        { label: 'Nights', value: String(closed.length), color: 'text-foreground' },
        { label: 'Avg players', value: avgPlayers.toFixed(1), color: 'text-foreground' },
      ]}
    />
  );
}

function CumulativeProfitChart({ data, profitCents }: { data: SessionStat[]; profitCents: number }) {
  const cumMin = Math.min(0, ...data.map((d) => d.cumProfit));
  const cumMax = Math.max(0, ...data.map((d) => d.cumProfit));
  const profitColor = profitCents >= 0 ? 'var(--primary)' : 'var(--destructive)';

  return (
    <div className='border border-border rounded-md p-5 mb-6'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-6'>Cumulative Profit</p>
      <ResponsiveContainer width='100%' height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id='profitGrad' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='5%' stopColor={profitColor} stopOpacity={0.15} />
              <stop offset='95%' stopColor={profitColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' vertical={false} />
          <XAxis dataKey='date' tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} dy={6} />
          <YAxis
            tickFormatter={(v: number) => `$${v}`}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={[cumMin - 5, cumMax + 5]}
          />
          <Tooltip content={<CumTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
          <ReferenceLine y={0} stroke='var(--border)' strokeDasharray='4 2' />
          <Area
            type='monotone'
            dataKey='cumProfit'
            stroke={profitColor}
            strokeWidth={2}
            fill='url(#profitGrad)'
            dot={data.length <= 12 ? { r: 3, fill: profitColor, strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: profitColor, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function RevenueCostChart({ data }: { data: SessionStat[] }) {
  return (
    <div className='border border-border rounded-md p-5'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-6'>Revenue vs Cost per Night</p>
      <ResponsiveContainer width='100%' height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap='30%'>
          <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' vertical={false} />
          <XAxis dataKey='date' tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} dy={6} />
          <YAxis
            tickFormatter={(v: number) => `$${v}`}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--muted)' }} />
          <Bar dataKey='revenue' name='Revenue' fill='var(--primary)' radius={[2, 2, 0, 0]} opacity={0.9} />
          <Bar dataKey='cost' name='Cost' fill='var(--muted-foreground)' radius={[2, 2, 0, 0]} opacity={0.5} />
        </BarChart>
      </ResponsiveContainer>
      <div className='flex gap-4 mt-4 justify-end'>
        <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
          <span className='size-2 rounded-sm bg-primary inline-block' />Revenue
        </span>
        <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
          <span className='size-2 rounded-sm bg-muted-foreground inline-block opacity-50' />Cost
        </span>
      </div>
    </div>
  );
}

function BarView({ closed, orders }: { closed: SessionWithPlayers[]; orders: readonly OrderRow[] }) {
  const totals = toBarTotals(closed, orders);
  return (
    <>
      <MoneySummary totals={totals} />
      <NightsSummary closed={closed} />
      <CumulativeProfitChart data={totals.stats} profitCents={totals.profitCents} />
      <RevenueCostChart data={totals.stats} />
    </>
  );
}

/** The host's drink profit across every closed night (was /stats). */
export function BarResults() {
  const sessions = useSWR('sessions', fetchSessions);
  const orders = useSWR('orders', fetchOrders);
  const closed = sessions.data && orders.data ? closedOldestFirst(sessions.data) : undefined;

  return (
    <DataState
      rows={closed}
      error={sessions.error ?? orders.error}
      onRetry={() => { sessions.mutate(); orders.mutate(); }}
      empty={
        <EmptyResults
          title='No closed sessions yet'
          detail='Close out a night and its drink revenue, cost and profit land here.'
          href='/session/new'
          action='Start a session'
        />
      }
    >
      {(rows) => <BarView closed={rows} orders={orders.data ?? []} />}
    </DataState>
  );
}

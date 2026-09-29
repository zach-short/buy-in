'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { centsToDollars, formatCents } from '@pb/core';
import { sumCents } from '@/lib/ledger';
import { fetchOrders, fetchSessions } from '@/lib/supabase/queries';

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

export default function StatsPage() {
  const router = useRouter();
  const { data: sessions = [] } = useSWR('sessions', fetchSessions);
  const { data: orders = [] } = useSWR('orders', fetchOrders);

  const closedSessions = [...sessions]
    .filter((s) => s.status === 'closed')
    .sort((a, b) => new Date(a.played_on).getTime() - new Date(b.played_on).getTime());

  let runningCents = 0;
  let totalRevenueCents = 0;
  let totalCostCents = 0;
  const data: SessionStat[] = closedSessions.map((s) => {
    const sessionOrders = orders.filter((o) => o.session_id === s.id);
    const revenueCents = sumCents(sessionOrders, (o) => o.price_cents);
    const costCents = sumCents(sessionOrders, (o) => o.cost_estimate_cents);
    const profitCents = revenueCents - costCents;
    runningCents += profitCents;
    totalRevenueCents += revenueCents;
    totalCostCents += costCents;
    return {
      name: s.name,
      date: shortDate(s.played_on),
      revenue: centsToDollars(revenueCents),
      cost: centsToDollars(costCents),
      profit: centsToDollars(profitCents),
      cumProfit: centsToDollars(runningCents),
    };
  });

  const totalProfitCents = runningCents;
  const margin = totalRevenueCents > 0 ? (totalProfitCents / totalRevenueCents) * 100 : 0;

  const cumMin = Math.min(0, ...data.map((d) => d.cumProfit));
  const cumMax = Math.max(0, ...data.map((d) => d.cumProfit));
  const profitColor = totalProfitCents >= 0 ? '#c9a84c' : '#e05252';

  if (closedSessions.length === 0) {
    return (
      <main className='min-h-screen px-6 py-10 max-w-3xl mx-auto'>
        <div className='flex items-center justify-between mb-10'>
          <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Stats</h1>
          <button onClick={() => router.back()} className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'>Back</button>
        </div>
        <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-24'>No closed sessions yet</p>
      </main>
    );
  }

  return (
    <main className='min-h-screen px-6 py-10 max-w-3xl mx-auto pb-24'>
      <div className='flex items-center justify-between mb-10'>
        <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Stats</h1>
        <button onClick={() => router.back()} className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'>Back</button>
      </div>

      <div className='grid grid-cols-2 gap-3 mb-10 sm:grid-cols-4'>
        {[
          { label: 'Revenue', value: `$${formatCents(totalRevenueCents)}`, color: 'text-foreground' },
          { label: 'Cost', value: `$${formatCents(totalCostCents)}`, color: 'text-muted-foreground' },
          { label: 'Profit', value: `$${formatCents(totalProfitCents)}`, color: totalProfitCents >= 0 ? 'text-primary' : 'text-destructive' },
          { label: 'Margin', value: `${margin.toFixed(1)}%`, color: margin >= 0 ? 'text-primary' : 'text-destructive' },
        ].map(({ label, value, color }) => (
          <div key={label} className='border border-border rounded-md p-4'>
            <p className='text-xs tracking-widest uppercase text-muted-foreground mb-1'>{label}</p>
            <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

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
            <CartesianGrid strokeDasharray='3 3' stroke='#222222' vertical={false} />
            <XAxis
              dataKey='date'
              tick={{ fontSize: 10, fill: '#6b6560' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={(v) => `$${v}`}
              tick={{ fontSize: 10, fill: '#6b6560' }}
              axisLine={false}
              tickLine={false}
              width={52}
              domain={[cumMin - 5, cumMax + 5]}
            />
            <Tooltip content={<CumTooltip />} cursor={{ stroke: '#222222', strokeWidth: 1 }} />
            <ReferenceLine y={0} stroke='#222222' strokeDasharray='4 2' />
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

      <div className='border border-border rounded-md p-5'>
        <p className='text-xs tracking-widest uppercase text-muted-foreground mb-6'>Revenue vs Cost per Night</p>
        <ResponsiveContainer width='100%' height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap='30%'>
            <CartesianGrid strokeDasharray='3 3' stroke='#222222' vertical={false} />
            <XAxis
              dataKey='date'
              tick={{ fontSize: 10, fill: '#6b6560' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={(v) => `$${v}`}
              tick={{ fontSize: 10, fill: '#6b6560' }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey='revenue' name='Revenue' fill='#c9a84c' radius={[2, 2, 0, 0]} opacity={0.9} />
            <Bar dataKey='cost' name='Cost' fill='#6b6560' radius={[2, 2, 0, 0]} opacity={0.5} />
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
    </main>
  );
}

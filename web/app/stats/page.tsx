'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { fetcher, Session, Order } from '@/lib/bar-api';

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function shortDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
  const { data: sessions = [] } = useSWR<Session[]>('/api/sessions', fetcher);
  const { data: orders = [] } = useSWR<Order[]>('/api/orders', fetcher);

  const closedSessions = [...sessions]
    .filter((s) => s.status === 'closed')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  const data: SessionStat[] = closedSessions.map((s) => {
    const sessionOrders = orders.filter((o) => o.sessionId === s.id);
    const revenue = sessionOrders.reduce((sum, o) => sum + o.price, 0);
    const cost = sessionOrders.reduce((sum, o) => sum + o.costEstimate, 0);
    const profit = revenue - cost;
    running += profit;
    return { name: s.name, date: shortDate(s.date), revenue, cost, profit, cumProfit: running };
  });

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalCost = data.reduce((s, d) => s + d.cost, 0);
  const totalProfit = running;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const cumMin = Math.min(0, ...data.map((d) => d.cumProfit));
  const cumMax = Math.max(0, ...data.map((d) => d.cumProfit));
  const profitColor = totalProfit >= 0 ? '#c9a84c' : '#e05252';

  if (closedSessions.length === 0) {
    return (
      <main className='min-h-screen px-6 py-10 max-w-sm mx-auto'>
        <div className='flex items-center justify-between mb-10'>
          <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Stats</h1>
          <button onClick={() => router.back()} className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'>Back</button>
        </div>
        <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-24'>No closed sessions yet</p>
      </main>
    );
  }

  return (
    <main className='min-h-screen px-6 py-10 max-w-2xl mx-auto pb-24'>
      <div className='flex items-center justify-between mb-10'>
        <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Stats</h1>
        <button onClick={() => router.back()} className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'>Back</button>
      </div>

      <div className='grid grid-cols-2 gap-3 mb-10 sm:grid-cols-4'>
        {[
          { label: 'Revenue', value: fmt(totalRevenue), color: 'text-foreground' },
          { label: 'Cost', value: fmt(totalCost), color: 'text-muted-foreground' },
          { label: 'Profit', value: fmt(totalProfit), color: totalProfit >= 0 ? 'text-primary' : 'text-destructive' },
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

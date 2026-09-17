'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, Session, Player, Order, BuyIn, Cashout } from '@/lib/bar-api';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: sessions = [] } = useSWR<Session[]>('/api/sessions', fetcher);
  const session = sessions.find((s) => s.id === id);
  const { data: players = [] } = useSWR<Player[]>('/api/players', fetcher);
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

  const sessionPlayers = players.filter((p) =>
    session?.playerIds?.includes(p.id),
  );
  const playersWithPhone = sessionPlayers.filter((p) => p.phone);

  const totalRevenue = orders.reduce((s, o) => s + o.price, 0);
  const totalCogs = orders.reduce((s, o) => s + o.costEstimate, 0);
  const totalProfit = totalRevenue - totalCogs;

  const [carouselIndex, setCarouselIndex] = useState(0);
  const [textIndex, setTextIndex] = useState<number | null>(null);
  const isDone = textIndex !== null && textIndex >= playersWithPhone.length;
  const current =
    textIndex !== null && !isDone ? playersWithPhone[textIndex] : null;

  function startTexting() {
    setTextIndex(0);
  }

  function openText(player: Player) {
    const url = `${window.location.origin}/receipt/${id}/${player.id}`;
    const body = encodeURIComponent(`${url}`);
    window.location.href = `sms:${player.phone}&body=${body}`;
    setTimeout(() => setTextIndex((i) => (i ?? 0) + 1), 500);
  }

  function skip() {
    setTextIndex((i) => (i ?? 0) + 1);
  }

  return (
    <main className='min-h-screen px-6 py-10 max-w-sm mx-auto pb-24'>
      <div className='mb-10'>
        <h1 className='text-base font-semibold tracking-widest uppercase text-primary mb-1'>
          Session Complete
        </h1>
        <p className='text-xs text-muted-foreground tracking-wide'>
          {session?.name}
        </p>
      </div>

      {sessionPlayers.length > 0 && (() => {
        const idx = Math.min(carouselIndex, sessionPlayers.length - 1);
        const player = sessionPlayers[idx];
        const playerBuyIns = buyIns.filter((b) => b.playerId === player.id);
        const playerCashout = cashouts.find((c) => c.playerId === player.id);
        const buyInTotal = playerBuyIns.reduce((s, b) => s + b.amount, 0);
        const cashoutAmount = playerCashout?.amount ?? 0;
        const net = buyInTotal - cashoutAmount;

        return (
          <div className='border border-border rounded-md mb-6'>
            <div className='flex items-center justify-between px-4 pt-4 pb-1'>
              <p className='text-xs tracking-widest uppercase text-muted-foreground'>Players</p>
              <p className='text-xs text-muted-foreground'>{idx + 1} / {sessionPlayers.length}</p>
            </div>

            <div className='flex items-center gap-2 px-2 pb-4'>
              <button
                onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                className='p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors'
              >
                <ChevronLeft size={18} />
              </button>

              <div className='flex-1 text-center px-2'>
                <p className='text-sm font-semibold tracking-wide uppercase mb-3'>{player.name}</p>
                <div className='space-y-1.5 text-sm'>
                  {playerBuyIns.map((b, i) => (
                    <div key={b.id} className='flex justify-between text-muted-foreground'>
                      <span>{i === 0 ? 'Buy-in' : 'Re-buy'}</span>
                      <span className='tabular-nums'>+${b.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {buyInTotal === 0 && (
                    <div className='flex justify-between text-muted-foreground'>
                      <span>Buy-in</span>
                      <span className='tabular-nums'>—</span>
                    </div>
                  )}
                  <div className='flex justify-between text-green-500'>
                    <span>Cash out</span>
                    <span className='tabular-nums'>
                      {playerCashout ? `−$${cashoutAmount.toFixed(2)}` : '—'}
                    </span>
                  </div>
                  <div className='flex justify-between font-semibold pt-1.5 border-t border-border'>
                    <span>{net > 0 ? 'They owe' : net < 0 ? 'You owe' : 'Even'}</span>
                    <span className={`tabular-nums ${net > 0 ? 'text-destructive' : net < 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {net === 0 ? '—' : `$${Math.abs(net).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setCarouselIndex((i) => Math.min(sessionPlayers.length - 1, i + 1))}
                disabled={idx === sessionPlayers.length - 1}
                className='p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors'
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {sessionPlayers.length > 1 && (
              <div className='flex justify-center gap-1 pb-3'>
                {sessionPlayers.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCarouselIndex(i)}
                    className={`h-1 rounded-full transition-all ${i === idx ? 'w-4 bg-primary' : 'w-1.5 bg-border'}`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <div className='border border-border rounded-md p-5 mb-8'>
        <p className='text-xs tracking-widest uppercase text-muted-foreground mb-4'>
          Bar Totals
        </p>
        <div className='grid grid-cols-3 gap-4 text-center'>
          <div>
            <p className='text-xs text-muted-foreground mb-1'>Revenue</p>
            <p className='text-xl font-semibold text-primary'>
              ${totalRevenue.toFixed(2)}
            </p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground mb-1'>Cost</p>
            <p className='text-xl font-semibold'>${totalCogs.toFixed(2)}</p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground mb-1'>Profit</p>
            <p
              className={`text-xl font-semibold ${totalProfit >= 0 ? 'text-primary' : 'text-destructive'}`}
            >
              ${totalProfit.toFixed(2)}
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
          const playerOrders = orders.filter((o) => o.playerId === player.id);
          const subtotal = playerOrders.reduce((s, o) => s + o.price, 0);
          if (playerOrders.length === 0) return null;
          return (
            <div key={player.id} className='border border-border rounded-md'>
              <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
                <span className='text-sm font-medium'>{player.name}</span>
                <div className='flex items-center gap-3'>
                  <span className='text-sm font-semibold text-primary'>
                    ${subtotal.toFixed(2)}
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
                      {order.drinkName}
                    </span>
                    <span className='tabular-nums'>
                      ${order.price.toFixed(2)}
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
    </main>
  );
}

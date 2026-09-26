'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { centsToDollars, formatCents, toCents } from '@pb/core';
import { apiFetch, markPlayerTabPaid, type CreateOrderResponse } from '@/lib/bar-api';
import { SESSION_POLL_INTERVAL_MS } from '@/lib/config';
import { sumCents } from '@/lib/ledger';
import {
  fetchDrinks, fetchInventory, fetchPlayers, fetchSession, fetchSessionBuyIns,
  fetchSessionCashouts, fetchSessionOrders,
  type DrinkWithIngredients, type OrderRow, type PlayerRow,
} from '@/lib/supabase/queries';
import { DrinkPickerModal } from '@/components/DrinkPickerModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatElapsed(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: session, mutate: mutateSession } = useSWR(['session', id], ([, sessionId]) => fetchSession(sessionId));
  const { data: players = [], mutate: mutatePlayers } = useSWR('players', fetchPlayers);
  const { data: orders = [], mutate: mutateOrders } = useSWR(
    ['orders', id], ([, sessionId]) => fetchSessionOrders(sessionId), { refreshInterval: SESSION_POLL_INTERVAL_MS }
  );
  const { data: buyIns = [], mutate: mutateBuyIns } = useSWR(
    ['buy_ins', id], ([, sessionId]) => fetchSessionBuyIns(sessionId)
  );
  const { data: cashouts = [], mutate: mutateCashouts } = useSWR(
    ['cashouts', id], ([, sessionId]) => fetchSessionCashouts(sessionId)
  );
  const { data: drinks = [] } = useSWR('drinks', fetchDrinks);
  const { data: inventory = [], mutate: mutateInventory } = useSWR('inventory', fetchInventory);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [elapsed, setElapsed] = useState('0m');

  const [rebuyPlayerId, setRebuyPlayerId] = useState<string | null>(null);
  const [rebuyAmount, setRebuyAmount] = useState('');
  const [rebuying, setRebuying] = useState(false);

  const [earlyCashoutPlayerId, setEarlyCashoutPlayerId] = useState<string | null>(null);
  const [earlyCashoutAmount, setEarlyCashoutAmount] = useState('');
  const [earlyCashingOut, setEarlyCashingOut] = useState(false);

  const [showCashout, setShowCashout] = useState(false);
  const [cashoutAmounts, setCashoutAmounts] = useState<Record<string, string>>({});
  const [closingSession, setClosingSession] = useState(false);

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addPlayerSearch, setAddPlayerSearch] = useState('');
  const [addPlayerBuyIn, setAddPlayerBuyIn] = useState('20');
  const [addingPlayer, setAddingPlayer] = useState(false);

  useEffect(() => {
    if (!session) return;
    const tick = () => setElapsed(formatElapsed(session.played_on));
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, [session]);

  useEffect(() => {
    // player_ids[0] — see the ordering note on withPlayerIds in lib/supabase/queries.ts.
    if (!selectedPlayerId && session?.player_ids.length) {
      setSelectedPlayerId(session.player_ids[0]);
    }
  }, [session, selectedPlayerId]);

  const sessionPlayers = players.filter((p) => session?.player_ids.includes(p.id));

  const tabTotalCents = useCallback(
    (playerId: string) => sumCents(orders.filter((o) => o.player_id === playerId), (o) => o.price_cents),
    [orders]
  );

  const buyInTotalCents = useCallback(
    (playerId: string) => sumCents(buyIns.filter((b) => b.player_id === playerId), (b) => b.amount_cents),
    [buyIns]
  );

  const isTabPaid = useCallback(
    (playerId: string) => {
      const playerOrders = orders.filter((o) => o.player_id === playerId);
      return playerOrders.length > 0 && playerOrders.every((o) => o.paid);
    },
    [orders]
  );

  const playerCashout = useCallback(
    (playerId: string) => cashouts.find((c) => c.player_id === playerId),
    [cashouts]
  );

  async function handleEarlyCashout(playerId: string) {
    const amount = parseFloat(earlyCashoutAmount);
    if (!amount || amount < 0) return;
    setEarlyCashingOut(true);
    try {
      await apiFetch('/api/cashouts', {
        method: 'POST',
        body: JSON.stringify({ sessionId: id, playerId, amount }),
      });
      toast.success(`Cashed out $${amount.toFixed(2)}`);
      mutateCashouts();
      setEarlyCashoutPlayerId(null);
      setEarlyCashoutAmount('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEarlyCashingOut(false);
    }
  }

  async function handleMarkPaid(playerId: string) {
    const alreadyPaid = isTabPaid(playerId);
    mutateOrders(orders.map((o) => o.player_id === playerId ? { ...o, paid: !alreadyPaid } : o), false);
    try {
      await markPlayerTabPaid(id, playerId, !alreadyPaid);
      mutateOrders();
    } catch (e) {
      mutateOrders();
      toast.error((e as Error).message);
    }
  }

  async function handleRebuy(playerId: string) {
    const amount = parseFloat(rebuyAmount);
    if (!amount || amount <= 0) return;
    setRebuying(true);
    try {
      await apiFetch('/api/buyins', {
        method: 'POST',
        body: JSON.stringify({ sessionId: id, playerId, amount }),
      });
      toast.success(`Re-buy $${amount.toFixed(2)} added`);
      mutateBuyIns();
      setRebuyPlayerId(null);
      setRebuyAmount('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRebuying(false);
    }
  }

  // Pick, because a player just created by the Go API (handleAddNewPlayer) arrives in that
  // API's shape, not as a PlayerRow; only id and name are read. Phase 6 ports this write.
  async function handleAddPlayer(player: Pick<PlayerRow, 'id' | 'name'>) {
    if (!session) return;
    setAddingPlayer(true);
    try {
      const currentIds = session.player_ids;
      if (currentIds.includes(player.id)) {
        toast.error(`${player.name} is already in this session`);
        return;
      }
      await apiFetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ playerIds: [...currentIds, player.id] }),
      });
      const buyIn = parseFloat(addPlayerBuyIn);
      if (buyIn > 0) {
        await apiFetch('/api/buyins', {
          method: 'POST',
          body: JSON.stringify({ sessionId: id, playerId: player.id, amount: buyIn }),
        });
        mutateBuyIns();
      }
      await mutateSession();
      setSelectedPlayerId(player.id);
      setShowAddPlayer(false);
      setAddPlayerSearch('');
      setAddPlayerBuyIn('20');
      toast.success(`${player.name} added`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAddingPlayer(false);
    }
  }

  async function handleAddNewPlayer(name: string) {
    if (!name.trim() || !session) return;
    setAddingPlayer(true);
    try {
      const player = await apiFetch<Pick<PlayerRow, 'id' | 'name'>>('/api/players', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      await mutatePlayers();
      await handleAddPlayer(player);
    } catch (e) {
      toast.error((e as Error).message);
      setAddingPlayer(false);
    }
  }

  async function handleCloseSession() {
    setClosingSession(true);
    try {
      await Promise.all(
        sessionPlayers.map((p) => {
          const amount = parseFloat(cashoutAmounts[p.id] ?? '0') || 0;
          const alreadyCashedOut = cashouts.some((c) => c.player_id === p.id);
          if (amount > 0 && !alreadyCashedOut) {
            return apiFetch('/api/cashouts', {
              method: 'POST',
              body: JSON.stringify({ sessionId: id, playerId: p.id, amount }),
            });
          }
        })
      );
      await apiFetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed' }),
      });
      router.push(`/session/${id}/summary`);
    } catch (e) {
      toast.error((e as Error).message);
      setClosingSession(false);
    }
  }

  const selectedOrders = orders
    .filter((o) => o.player_id === selectedPlayerId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  async function handleDrinkSelect(drink: DrinkWithIngredients) {
    if (!selectedPlayerId || !session) return;
    setShowPicker(false);
    const tempId = `temp-${Date.now()}`;
    const optimistic: OrderRow = {
      id: tempId, bar_id: session.bar_id, session_id: id, player_id: selectedPlayerId,
      drink_id: drink.id, drink_name: drink.name, price_cents: drink.price_cents,
      cost_estimate_cents: drink.cost_estimate_cents, ingredients: [],
      created_at: new Date().toISOString(), paid: false,
    };
    mutateOrders([optimistic, ...orders], false);
    try {
      const res = await apiFetch<CreateOrderResponse>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ sessionId: id, playerId: selectedPlayerId, drinkId: drink.id }),
      });
      toast.success(`${drink.name} added`);
      if (res.lowStockWarnings?.length) {
        res.lowStockWarnings.forEach((n) => toast.warning(`Low stock: ${n}`));
      }
      mutateOrders();
      mutateInventory();
    } catch (e) {
      mutateOrders(orders.filter((o) => o.id !== tempId), false);
      toast.error((e as Error).message);
    }
  }

  async function handleUndo(order: OrderRow) {
    mutateOrders(orders.filter((o) => o.id !== order.id), false);
    try {
      await apiFetch(`/api/orders/${order.id}`, { method: 'DELETE' });
      toast.success('Order removed');
      mutateOrders();
      mutateInventory();
    } catch (e) {
      mutateOrders();
      toast.error((e as Error).message);
    }
  }

  if (!session) {
    return <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>Loading…</div>;
  }

  if (showCashout) {
    // The typed chip values are dollars; they enter the pot arithmetic as cents so that
    // "remaining === 0" is exact rather than a float comparison.
    const totalBuyInsCents = sumCents(sessionPlayers, (p) => buyInTotalCents(p.id));
    const totalCashedOutCents = sumCents(sessionPlayers, (p) => toCents(parseFloat(cashoutAmounts[p.id] ?? '0') || 0));
    const remainingCents = totalBuyInsCents - totalCashedOutCents;
    const isOver = remainingCents < 0;

    return (
      <main className='min-h-screen flex flex-col max-w-lg mx-auto px-6 py-10'>
        <div className='mb-6'>
          <h1 className='text-base font-semibold tracking-widest uppercase text-primary mb-1'>Cash Out</h1>
          <p className='text-xs text-muted-foreground'>Enter each player&apos;s chip value to close the session.</p>
        </div>

        <div className='border border-border rounded-md px-5 py-4 mb-6 flex items-center justify-between'>
          <div>
            <p className='text-xs tracking-widest uppercase text-muted-foreground'>Pot remaining</p>
            <p className={`text-2xl font-bold mt-0.5 tabular-nums ${isOver ? 'text-destructive' : remainingCents === 0 ? 'text-green-500' : 'text-foreground'}`}>
              ${formatCents(Math.abs(remainingCents))}
              {isOver && <span className='text-xs font-normal ml-1 text-destructive'>over</span>}
            </p>
          </div>
          <div className='text-right text-xs text-muted-foreground space-y-0.5'>
            <p>${formatCents(totalBuyInsCents)} total buy-ins</p>
            <p>−${formatCents(totalCashedOutCents)} cashed out</p>
          </div>
        </div>

        <div className='space-y-4 flex-1'>
          {sessionPlayers.map((player) => {
            const drinksCents = tabTotalCents(player.id);
            const buysCents = buyInTotalCents(player.id);
            return (
              <div key={player.id} className='border border-border rounded-md px-4 py-4'>
                <div className='flex items-center justify-between mb-3'>
                  <span className='text-sm font-medium'>{player.name}</span>
                  <div className='text-right text-xs text-muted-foreground'>
                    <span>Bought in ${formatCents(buysCents)}</span>
                    {drinksCents > 0 && <span> · Drinks ${formatCents(drinksCents)}</span>}
                  </div>
                </div>
                <div className='relative'>
                  <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm'>$</span>
                  <Input
                    type='number'
                    min='0'
                    step='1'
                    placeholder='0'
                    value={cashoutAmounts[player.id] ?? ''}
                    onChange={(e) => setCashoutAmounts((prev) => ({ ...prev, [player.id]: e.target.value }))}
                    className='h-11 pl-7'
                  />
                </div>
                <p className='text-xs text-muted-foreground mt-1'>Chip value they&apos;re walking away with</p>
              </div>
            );
          })}
        </div>

        <div className='flex gap-3 mt-8'>
          <Button
            variant='outline'
            className='flex-1 h-12 text-xs tracking-widest uppercase'
            onClick={() => setShowCashout(false)}
            disabled={closingSession}
          >
            Back
          </Button>
          <Button
            className='flex-1 h-12 text-xs tracking-widest uppercase'
            onClick={handleCloseSession}
            disabled={closingSession}
          >
            {closingSession ? 'Closing…' : 'Close Session'}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className='min-h-screen flex flex-col max-w-lg mx-auto'>
      {/* Top bar */}
      <div className='sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <h1 className='text-sm font-semibold tracking-widest uppercase text-primary truncate'>{session.name}</h1>
          <p className='text-xs text-muted-foreground mt-0.5'>{elapsed}</p>
        </div>
        <Button
          variant='destructive'
          size='sm'
          className='shrink-0 h-9 text-xs tracking-widest uppercase'
          onClick={() => {
            const prefill: Record<string, string> = {};
            cashouts.forEach((c) => { prefill[c.player_id] = String(centsToDollars(c.amount_cents)); });
            setCashoutAmounts(prefill);
            setShowCashout(true);
          }}
        >
          End Session
        </Button>
      </div>

      {/* Player tabs */}
      <div className='px-6 py-4 flex gap-2 overflow-x-auto scrollbar-none shrink-0 border-b border-border'>
        {sessionPlayers.map((player) => (
          <button
            key={player.id}
            onClick={() => {
              setSelectedPlayerId(player.id);
              setRebuyPlayerId(null);
              setEarlyCashoutPlayerId(null);
              setShowAddPlayer(false);
            }}
            className={cn(
              'flex-none flex flex-col items-center gap-1 px-4 py-2.5 rounded border transition-colors min-w-[72px]',
              selectedPlayerId === player.id
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            )}
          >
            <span className='text-xs font-medium truncate max-w-[80px]'>{player.name}</span>
            <span className='text-xs tabular-nums'>${formatCents(tabTotalCents(player.id))}</span>
            {isTabPaid(player.id) && (
              <span className='text-[9px] tracking-widest uppercase text-green-500'>Paid</span>
            )}
          </button>
        ))}
        <button
          onClick={() => {
            setShowAddPlayer((v) => !v);
            setSelectedPlayerId(null);
            setRebuyPlayerId(null);
            setEarlyCashoutPlayerId(null);
            setAddPlayerSearch('');
          }}
          className={cn(
            'flex-none flex items-center justify-center px-3 py-2.5 rounded border transition-colors min-w-[44px]',
            showAddPlayer
              ? 'border-primary text-primary'
              : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
          )}
        >
          <span className='text-lg leading-none'>+</span>
        </button>
      </div>

      {/* Add player panel */}
      {showAddPlayer && (
        <div className='px-6 py-4 border-b border-border space-y-3'>
          <div className='flex items-center gap-2'>
            <div className='relative flex-1'>
              <Input
                autoFocus
                placeholder='Search or add player…'
                value={addPlayerSearch}
                onChange={(e) => setAddPlayerSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && addPlayerSearch.trim()) {
                    const match = players.find(
                      (p) => p.name.toLowerCase() === addPlayerSearch.trim().toLowerCase() &&
                        !session?.player_ids.includes(p.id)
                    );
                    if (match) handleAddPlayer(match);
                    else handleAddNewPlayer(addPlayerSearch.trim());
                  }
                }}
                className='h-9 text-sm'
                disabled={addingPlayer}
              />
            </div>
            <div className='relative w-24 shrink-0'>
              <span className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs'>$</span>
              <Input
                type='number'
                min='0'
                step='5'
                value={addPlayerBuyIn}
                onChange={(e) => setAddPlayerBuyIn(e.target.value)}
                className='h-9 pl-6 text-sm'
                disabled={addingPlayer}
                placeholder='20'
              />
            </div>
          </div>
          {addPlayerSearch.trim() && (() => {
            const matches = players.filter(
              (p) =>
                p.name.toLowerCase().includes(addPlayerSearch.toLowerCase()) &&
                !session?.player_ids.includes(p.id)
            );
            if (matches.length === 0) {
              return (
                <button
                  onClick={() => handleAddNewPlayer(addPlayerSearch.trim())}
                  disabled={addingPlayer}
                  className='w-full text-left text-sm px-3 py-2 rounded border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40'
                >
                  + Create &ldquo;{addPlayerSearch.trim()}&rdquo;
                </button>
              );
            }
            return (
              <div className='border border-border rounded-md divide-y divide-border'>
                {matches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddPlayer(p)}
                    disabled={addingPlayer}
                    className='w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors disabled:opacity-40'
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {selectedPlayerId && (
        <div className='px-6 py-3 border-b border-border space-y-3'>
          <div className='flex items-center justify-between gap-3'>
            <div className='text-xs text-muted-foreground'>
              Buy-ins: <span className='text-foreground font-medium'>${formatCents(buyInTotalCents(selectedPlayerId))}</span>
              {playerCashout(selectedPlayerId) && (
                <span className='ml-2 text-green-500 font-medium'>
                  · Cashed out ${formatCents(playerCashout(selectedPlayerId)!.amount_cents)}
                </span>
              )}
            </div>
            {rebuyPlayerId !== selectedPlayerId && earlyCashoutPlayerId !== selectedPlayerId && (
              <div className='flex gap-3'>
                {!playerCashout(selectedPlayerId) && (
                  <button
                    onClick={() => { setEarlyCashoutPlayerId(selectedPlayerId); setEarlyCashoutAmount(''); setRebuyPlayerId(null); }}
                    className='text-xs tracking-widest uppercase text-muted-foreground hover:text-green-500 transition-colors'
                  >
                    Cash Out
                  </button>
                )}
                <button
                  onClick={() => { setRebuyPlayerId(selectedPlayerId); setRebuyAmount(''); setEarlyCashoutPlayerId(null); }}
                  className='text-xs tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors'
                >
                  + Re-buy
                </button>
              </div>
            )}
          </div>

          {rebuyPlayerId === selectedPlayerId && (
            <div className='flex items-center gap-2'>
              <div className='relative w-28'>
                <span className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs'>$</span>
                <Input
                  type='number'
                  min='0'
                  step='5'
                  autoFocus
                  placeholder='20'
                  value={rebuyAmount}
                  onChange={(e) => setRebuyAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRebuy(selectedPlayerId)}
                  className='h-8 pl-6 text-sm'
                />
              </div>
              <button
                onClick={() => handleRebuy(selectedPlayerId)}
                disabled={rebuying || !rebuyAmount}
                className='text-xs tracking-widest uppercase text-primary disabled:opacity-40'
              >
                Add
              </button>
              <button
                onClick={() => { setRebuyPlayerId(null); setRebuyAmount(''); }}
                className='text-xs text-muted-foreground'
              >
                Cancel
              </button>
            </div>
          )}

          {earlyCashoutPlayerId === selectedPlayerId && (
            <div className='flex items-center gap-2'>
              <div className='relative w-28'>
                <span className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs'>$</span>
                <Input
                  type='number'
                  min='0'
                  step='1'
                  autoFocus
                  placeholder='0'
                  value={earlyCashoutAmount}
                  onChange={(e) => setEarlyCashoutAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEarlyCashout(selectedPlayerId)}
                  className='h-8 pl-6 text-sm'
                />
              </div>
              <button
                onClick={() => handleEarlyCashout(selectedPlayerId)}
                disabled={earlyCashingOut || !earlyCashoutAmount}
                className='text-xs tracking-widest uppercase text-green-500 disabled:opacity-40'
              >
                Confirm
              </button>
              <button
                onClick={() => { setEarlyCashoutPlayerId(null); setEarlyCashoutAmount(''); }}
                className='text-xs text-muted-foreground'
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Orders list */}
      <div className='flex-1 px-6 py-4 pb-32'>
        {selectedOrders.length === 0 ? (
          <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>No orders yet</p>
        ) : (
          <div className='divide-y divide-border border border-border rounded-md'>
            {selectedOrders.map((order) => (
              <div key={order.id} className='flex items-center justify-between px-4 py-3 min-h-[52px]'>
                <div className='min-w-0'>
                  <p className='text-sm'>{order.drink_name}</p>
                  <p className='text-xs text-muted-foreground'>{formatTime(order.created_at)}</p>
                </div>
                <div className='flex items-center gap-3 shrink-0'>
                  <span className='text-sm font-semibold text-primary tabular-nums'>${formatCents(order.price_cents)}</span>
                  {!order.id.startsWith('temp-') && (
                    <button
                      onClick={() => handleUndo(order)}
                      className='size-8 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors'
                    >
                      <Trash2 className='size-3.5' />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mark Paid */}
      {selectedPlayerId && orders.filter((o) => o.player_id === selectedPlayerId).length > 0 && (
        <div className='px-6 pb-6'>
          <button
            onClick={() => handleMarkPaid(selectedPlayerId)}
            className={cn(
              'w-full py-3 rounded border text-xs tracking-widest uppercase font-medium transition-colors',
              isTabPaid(selectedPlayerId)
                ? 'border-green-500/50 text-green-500 hover:border-green-500'
                : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
            )}
          >
            {isTabPaid(selectedPlayerId) ? '✓ Paid — Mark Unpaid' : 'Mark Paid'}
          </button>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowPicker(true)}
        className='fixed bottom-6 right-6 size-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40 text-2xl font-light'
      >
        +
      </button>

      {showPicker && (
        <DrinkPickerModal
          drinks={drinks}
          inventory={inventory}
          onSelect={handleDrinkSelect}
          onClose={() => setShowPicker(false)}
        />
      )}
    </main>
  );
}

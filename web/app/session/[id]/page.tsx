'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCents } from '@pb/core';
import { useBarFeatures } from '@/hooks/use-bar-features';
import { useConfirm } from '@/hooks/use-confirm';
import { sumCents } from '@/lib/ledger';
import { cn } from '@/lib/utils';
import { DrinkPickerModal } from '@/components/drink-picker-modal';
import { StatusScreen } from '@/components/shared/status-screen';
import { AddPlayerPanel } from '@/components/session/add-player-panel';
import { CashOutScreen } from '@/components/session/cash-out-screen';
import { OrderList } from '@/components/session/order-list';
import { PlayerMoneyPanel } from '@/components/session/player-money-panel';
import { PlayerStrip } from '@/components/session/player-strip';
import { SessionTopBar } from '@/components/session/session-top-bar';
import { useCloseSession } from '@/components/session/use-close-session';
import { useDrinkPours } from '@/components/session/use-drink-pours';
import { useLiveSession } from '@/components/session/use-live-session';
import { usePlayerMoney } from '@/components/session/use-player-money';

// The host's live screen for one night: who is seated, their drinks, buy-ins and cash-outs,
// and closing the night. Reads and realtime are in useLiveSession; every write is in one of
// the three hooks below, each of which asks (useConfirm) before anything unusual touches money.
export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  // With drinks off there is no pouring here, but a drink already on a tab still shows as that
  // player's total, because it is still part of what they owe (host-setup PLAN §0 row 8).
  const features = useBarFeatures();
  const drinksOn = features.visible.drinks;
  // The menu and stock reads wait for the switch itself: `visible` reads "on" while loading.
  // A failed settings load keeps them, as it keeps everything else on.
  const live = useLiveSession(id, drinksOn && (features.settings !== undefined || features.error !== undefined));
  const { session, players = [], orders, buyIns, cashouts } = live;
  const { confirm, confirmDialog } = useConfirm();
  const pours = useDrinkPours(session, live, confirm);
  const money = usePlayerMoney(session, live, confirm);

  // Seated players in the players list's (name) order.
  const seated = players.filter((p) => session?.player_ids.includes(p.id));
  const close = useCloseSession(session, seated, live, confirm);

  const [pickedPlayerId, setPickedPlayerId] = useState<string | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showCashout, setShowCashout] = useState(false);
  // Falls back to player_ids[0] — see the ordering note on withPlayerIds in
  // lib/supabase/queries.ts — until the host picks, or if the pick has left the table.
  const picked = pickedPlayerId && session?.player_ids.includes(pickedPlayerId) ? pickedPlayerId : null;
  const selectedId = showAddPlayer ? null : picked ?? session?.player_ids[0] ?? null;
  const selected = seated.find((p) => p.id === selectedId) ?? null;

  // A closed night has nothing live to do: its controls would write into a finished ledger.
  const closed = !!session && session.status !== 'active';
  useEffect(() => {
    if (closed) router.replace(`/session/${id}/summary`);
  }, [closed, id, router]);

  const tabCents = (playerId: string) => sumCents(orders.filter((o) => o.player_id === playerId), (o) => o.price_cents);
  const buyInCents = (playerId: string) => sumCents(buyIns.filter((b) => b.player_id === playerId), (b) => b.amount_cents);
  const cashoutOf = (playerId: string) => cashouts.find((c) => c.player_id === playerId);
  const isTabPaid = (playerId: string) => {
    const playerOrders = orders.filter((o) => o.player_id === playerId);
    return playerOrders.length > 0 && playerOrders.every((o) => o.paid);
  };

  if (live.loadError) {
    return (
      <StatusScreen
        kind='error'
        title='Couldn’t load this session'
        message={live.loadError.message}
        action={{ label: 'Retry', onClick: live.retryLoad }}
        secondaryAction={{ label: 'All sessions', href: '/sessions' }}
      />
    );
  }
  if (session === null) {
    return <StatusScreen kind='empty' title='Session not found' action={{ label: 'All sessions', href: '/sessions' }} />;
  }
  if (!session || closed) return <StatusScreen kind='loading' />;

  if (showCashout) {
    return (
      <>
        <CashOutScreen close={close} buyInCents={buyInCents} tabCents={tabCents} onBack={() => setShowCashout(false)} />
        {confirmDialog}
      </>
    );
  }

  const selectedOrders = orders
    .filter((o) => o.player_id === selectedId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const selectedCashout = selected ? cashoutOf(selected.id) : undefined;

  // A player who has cashed out usually should not be drinking on the tab; ask once per
  // picker, not once per drink.
  async function openPicker() {
    if (!selected) return;
    if (selectedCashout && !(await confirm({
      title: `${selected.name} has cashed out`,
      description: `They left with $${formatCents(selectedCashout.amount_cents)}. Add drinks to their tab anyway?`,
      confirmLabel: 'Add drinks',
    }))) return;
    setShowPicker(true);
  }

  return (
    // The bottom padding keeps the drink button off the last row and the tab-checked note; this
    // route has no nav bar, so the home-indicator inset is ours to clear either way.
    <main
      className={cn(
        'min-h-screen w-full flex flex-col max-w-3xl mx-auto',
        drinksOn ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
      )}
    >
      <SessionTopBar
        name={session.name}
        playedOn={session.played_on}
        subscribed={live.subscribed}
        onEnd={() => { close.prefill(); setShowCashout(true); }}
      />

      <PlayerStrip
        players={seated.map((player) => ({
          player,
          tabCents: tabCents(player.id),
          buyInCents: buyInCents(player.id),
          paid: isTabPaid(player.id),
          out: cashoutOf(player.id) !== undefined,
        }))}
        showEmptyTabs={drinksOn}
        selectedId={selectedId}
        addOpen={showAddPlayer}
        onSelect={(playerId) => { setPickedPlayerId(playerId); setShowAddPlayer(false); }}
        onToggleAdd={() => setShowAddPlayer((v) => !v)}
      />

      {showAddPlayer && (
        <AddPlayerPanel
          sessionId={id}
          seatedIds={session.player_ids}
          players={players}
          live={live}
          confirm={confirm}
          onAdded={(playerId) => { setPickedPlayerId(playerId); setShowAddPlayer(false); }}
        />
      )}

      {selected && (
        <PlayerMoneyPanel
          key={selected.id}
          player={selected}
          buyIns={buyIns.filter((b) => b.player_id === selected.id)}
          cashout={selectedCashout}
          money={money}
        />
      )}

      {drinksOn && selected && (
        <OrderList
          orders={selectedOrders}
          paid={isTabPaid(selected.id)}
          onUndo={(order) => pours.undo(order, selected.name)}
          onTogglePaid={() => pours.setPaid(selected.id, !isTabPaid(selected.id))}
        />
      )}

      {drinksOn && (
        <button
          type='button'
          aria-label={selected ? `Add a drink for ${selected.name}` : 'Add a drink'}
          onClick={openPicker}
          disabled={!selected}
          className='fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 size-14 rounded-full border border-primary/60 bg-background text-primary flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40 text-2xl font-light disabled:opacity-40'
        >
          <span aria-hidden='true'>+</span>
        </button>
      )}

      {drinksOn && showPicker && selected && (
        <DrinkPickerModal
          drinks={live.drinks}
          inventory={live.inventory}
          orders={orders}
          playerName={selected.name}
          lastDrinkId={selectedOrders[0]?.drink_id ?? null}
          onPour={(drink) => pours.pour(selected.id, drink)}
          onClose={() => setShowPicker(false)}
        />
      )}

      {confirmDialog}
    </main>
  );
}

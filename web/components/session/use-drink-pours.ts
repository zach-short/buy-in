'use client';

import { toast } from 'sonner';

import type { ConfirmOptions } from '@/hooks/use-confirm';
import { canMakeDrink } from '@/lib/recipes';
import { createOrderAllowShort } from '@/lib/supabase/drink-stock';
import {
  fetchSessionOrders, type DrinkWithIngredients, type InventoryRow, type OrderRow, type SessionWithPlayers,
} from '@/lib/supabase/queries';
import { pourDrink, setTabPaid, undoOrder } from '@/lib/supabase/writes';
import { isNetworkError, writeFailureMessage } from './money-guards';
import type { LiveSession } from './use-live-session';

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

// Rapid taps in the picker land in the same millisecond; the counter keeps temp ids distinct
// so rolling one back cannot remove another.
let tempSeq = 0;

function countPours(orders: readonly OrderRow[], playerId: string, drinkId: string): number {
  return orders.filter((o) => o.player_id === playerId && o.drink_id === drinkId && !o.id.startsWith('temp-')).length;
}

function optimisticOrder(session: SessionWithPlayers, playerId: string, drink: DrinkWithIngredients): OrderRow {
  return {
    id: `temp-${Date.now()}-${++tempSeq}`, bar_id: session.bar_id, session_id: session.id, player_id: playerId,
    drink_id: drink.id, drink_name: drink.name, price_cents: drink.price_cents,
    cost_estimate_cents: drink.cost_estimate_cents, ingredients: [],
    created_at: new Date().toISOString(), paid: false,
  };
}

/** "Stock says 0 Gin left" — the first ingredient the count says is short. */
function shortStockLine(drink: DrinkWithIngredients, inventory: readonly InventoryRow[]): string {
  for (const ing of drink.ingredients) {
    const item = inventory.find((i) => i.id === ing.item_id);
    if (!item) return `Stock has no record of one of ${drink.name}'s ingredients.`;
    if (item.qty_on_hand < ing.qty_used) return `Stock says ${Number(item.qty_on_hand.toFixed(2))} ${item.unit} of ${item.name} left.`;
  }
  return `Stock says there is not enough for ${drink.name}.`;
}

// All optimistic writes go through functional updaters: the orders a handler closed over are
// the render's, and a realtime refetch or a second quick pour may have replaced them since —
// rolling back to that snapshot would silently drop those rows from the screen.
export function useDrinkPours(session: SessionWithPlayers | null | undefined, live: LiveSession, confirm: Confirm) {
  function playerName(playerId: string): string {
    return live.players?.find((p) => p.id === playerId)?.name ?? 'This player';
  }

  function confirmPourAnyway(detail: string, drink: DrinkWithIngredients): Promise<boolean> {
    return confirm({
      title: `Pour ${drink.name} anyway?`,
      description: `${detail} Pour anyway? Stock will be set to 0.`,
      confirmLabel: 'Pour anyway',
    });
  }

  async function writePour(playerId: string, drink: DrinkWithIngredients, allowShort: boolean): Promise<boolean> {
    if (!session) return false;
    const optimistic = optimisticOrder(session, playerId, drink);
    let before = 0;
    void live.mutateOrders((current = []) => {
      before = countPours(current, playerId, drink.id);
      return [optimistic, ...current];
    }, { revalidate: false });
    try {
      const res = allowShort
        ? await createOrderAllowShort(session.id, playerId, drink.id)
        : await pourDrink(session.id, playerId, drink.id);
      toast.success(`${drink.name} added`);
      res.lowStockWarnings?.forEach((n) => toast.warning(`Low stock: ${n}`));
      void live.mutateOrders();
      void live.mutateInventory();
      return true;
    } catch (e) {
      void live.mutateOrders((current = []) => current.filter((o) => o.id !== optimistic.id), { revalidate: false });
      reportPourFailure(e, playerId, drink, allowShort, before);
      return false;
    }
  }

  function reportPourFailure(e: unknown, playerId: string, drink: DrinkWithIngredients, allowShort: boolean, before: number) {
    if (isNetworkError(e)) {
      toast.error('No connection — drink not saved', {
        action: { label: 'Retry', onClick: () => void retryPour(playerId, drink, allowShort, before) },
      });
      return;
    }
    const message = writeFailureMessage(e, 'No connection — drink not saved');
    // The picker's stock was stale (another device poured the last of it): offer the same
    // override the picker offers for a drink it already knows is short. Keyed on the message,
    // not the errcode: 'drink is archived', 'session is closed' and 'player is not in this
    // session' share check_violation, and none of those may be poured past.
    if (!allowShort && /insufficient stock/i.test(message)) {
      toast.error(message, {
        action: {
          label: 'Pour anyway',
          onClick: async () => { if (await confirmPourAnyway(`${message}.`, drink)) void writePour(playerId, drink, true); },
        },
      });
      return;
    }
    toast.error(message);
  }

  // A request that never got an answer may still have committed, and without an idempotency
  // key the tab cannot say which pour a row came from. So re-read it: if this player now has
  // more of this drink than before the failed pour, it may have gone through — or a second,
  // separate pour did — and only the host knows which. Ask; never decide silently.
  async function retryPour(playerId: string, drink: DrinkWithIngredients, allowShort: boolean, before: number) {
    if (!session) return;
    let fresh: OrderRow[];
    try {
      fresh = await fetchSessionOrders(session.id);
    } catch (e) {
      reportPourFailure(e, playerId, drink, allowShort, before);
      return;
    }
    void live.mutateOrders(fresh, { revalidate: false });
    const now = countPours(fresh, playerId, drink.id);
    if (now > before && !(await confirm({
      title: 'Pour another?',
      description: `${playerName(playerId)}'s tab now shows ${now} ${drink.name}. The failed pour may have gone through.`,
      confirmLabel: 'Pour',
      cancelLabel: "Don't",
    }))) return;
    await writePour(playerId, drink, allowShort);
  }

  /** Pours, or — when stock says the drink is short — asks first and pours past the count. */
  async function pour(playerId: string, drink: DrinkWithIngredients): Promise<boolean> {
    if (canMakeDrink(drink, live.inventory)) return writePour(playerId, drink, false);
    if (!(await confirmPourAnyway(shortStockLine(drink, live.inventory), drink))) return false;
    return writePour(playerId, drink, true);
  }

  async function undo(order: OrderRow, playerName: string) {
    void live.mutateOrders((current = []) => current.filter((o) => o.id !== order.id), { revalidate: false });
    try {
      await undoOrder(order.id);
      toast.success(`${order.drink_name} removed from ${playerName}'s tab`);
      void live.mutateInventory();
    } catch (e) {
      toast.error(writeFailureMessage(e, `No connection — ${order.drink_name} not removed`));
    } finally {
      void live.mutateOrders();
    }
  }

  async function setPaid(playerId: string, paid: boolean) {
    if (!session) return;
    void live.mutateOrders(
      (current = []) => current.map((o) => (o.player_id === playerId ? { ...o, paid } : o)),
      { revalidate: false },
    );
    try {
      await setTabPaid(session.id, playerId, paid);
    } catch (e) {
      toast.error(writeFailureMessage(e, 'No connection — tab not updated'));
    } finally {
      void live.mutateOrders();
    }
  }

  return { pour, undo, setPaid };
}

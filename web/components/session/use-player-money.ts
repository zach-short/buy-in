'use client';

import { toast } from 'sonner';
import { formatCents } from '@pb/core';

import { parseMoneyInput } from '@/components/ui/money-input';
import type { ConfirmOptions } from '@/hooks/use-confirm';
import type { BuyInRow, CashoutRow, PlayerRow, SessionWithPlayers } from '@/lib/supabase/queries';
import { deleteBuyIn, deleteCashout, updateBuyInAmount, updateCashoutAmount } from '@/lib/supabase/session-edits';
import { createBuyIn, createCashout } from '@/lib/supabase/writes';
import { confirmLargeAmount, isDuplicateCashout, LARGE_AMOUNT_CENTS, writeFailureMessage } from './money-guards';
import type { LiveSession } from './use-live-session';

type Confirm = (options: ConfirmOptions) => Promise<boolean>;
type Player = Pick<PlayerRow, 'id' | 'name'>;

// A network failure on an insert may still have committed, so the message says to look
// rather than "not saved"; every handler refetches its list afterwards either way.
const MAYBE_SAVED = 'No connection — it may not have saved. Check the list before trying again.';

const money = (cents: number) => `$${formatCents(cents)}`;

function largeNote(cents: number): string {
  return cents > LARGE_AMOUNT_CENTS ? ' That is more than $100 in one entry.' : '';
}

/**
 * Every buy-in and cash-out write on the live screen: re-buys, early cash-outs, and fixing or
 * removing a mistyped row. Each returns true when it saved, so the form can close. Amounts
 * come in as MoneyInput strings; blank is never read as $0.
 */
export function usePlayerMoney(session: SessionWithPlayers | null | undefined, live: LiveSession, confirm: Confirm) {
  function cashoutOf(playerId: string): CashoutRow | undefined {
    return live.cashouts.find((c) => c.player_id === playerId);
  }

  async function run(write: () => Promise<void>, success: string, refetch: () => Promise<unknown>): Promise<boolean> {
    try {
      await write();
      toast.success(success);
      return true;
    } catch (e) {
      toast.error(writeFailureMessage(e, MAYBE_SAVED));
      return false;
    } finally {
      void refetch();
    }
  }

  async function rebuy(player: Player, value: string): Promise<boolean> {
    const cents = parseMoneyInput(value);
    if (!session) return false;
    if (cents === null || cents === 0) {
      toast.error('Enter a re-buy amount above $0');
      return false;
    }
    const out = cashoutOf(player.id);
    if (out && !(await confirm({
      title: `${player.name} has cashed out`,
      description: `They cashed out ${money(out.amount_cents)}. Record a re-buy anyway? If they play on, fix their cash-out when the night ends.`,
      confirmLabel: 'Re-buy anyway',
    }))) return false;
    if (!(await confirmLargeAmount(confirm, cents, 're-buy', player.name))) return false;
    return run(() => createBuyIn(session, player.id, cents), `Re-buy ${money(cents)} added for ${player.name}`, () => live.mutateBuyIns());
  }

  async function cashOutEarly(player: Player, value: string): Promise<boolean> {
    const cents = parseMoneyInput(value);
    if (!session) return false;
    if (cents === null) {
      toast.error(`Enter what ${player.name} is walking away with — or tap Busted for $0`);
      return false;
    }
    if (cashoutOf(player.id)) {
      toast.error(`${player.name} already has a cash-out — edit it in their list`);
      return false;
    }
    if (cents === 0 && !(await confirm({
      title: `Mark ${player.name} out — busted?`,
      description: 'Records a $0 cash-out. You can edit or delete it from their list.',
      confirmLabel: 'Busted',
    }))) return false;
    if (!(await confirmLargeAmount(confirm, cents, 'cash-out', player.name))) return false;
    try {
      await createCashout(session, player.id, cents);
      toast.success(cents === 0 ? `${player.name} marked out — busted` : `${player.name} cashed out ${money(cents)}`);
      return true;
    } catch (e) {
      toast.error(isDuplicateCashout(e) ? `${player.name} already has a cash-out — edit it in their list` : writeFailureMessage(e, MAYBE_SAVED));
      return false;
    } finally {
      void live.mutateCashouts();
    }
  }

  async function editBuyIn(row: BuyInRow, player: Player, label: string, value: string): Promise<boolean> {
    const cents = parseMoneyInput(value);
    if (cents === null) {
      toast.error('Enter an amount');
      return false;
    }
    // buy_ins.amount_cents is check (> 0) (0001).
    if (cents === 0) {
      toast.error(`A ${label.toLowerCase()} can't be $0 — delete it instead`);
      return false;
    }
    if (cents === row.amount_cents) return true;
    if (!(await confirm({
      title: `Change ${player.name}'s ${label.toLowerCase()} from ${money(row.amount_cents)} to ${money(cents)}?`,
      description: `Their buy-in total goes ${cents > row.amount_cents ? 'up' : 'down'} by ${money(Math.abs(cents - row.amount_cents))}.${largeNote(cents)}`,
      confirmLabel: 'Change it',
    }))) return false;
    return run(() => updateBuyInAmount(row.id, cents), `${label} changed to ${money(cents)}`, () => live.mutateBuyIns());
  }

  async function removeBuyIn(row: BuyInRow, player: Player, label: string): Promise<boolean> {
    if (!(await confirm({
      title: `Delete ${player.name}'s ${money(row.amount_cents)} ${label.toLowerCase()}?`,
      description: 'It comes off their buy-in total and the pot.',
      confirmLabel: 'Delete',
      destructive: true,
    }))) return false;
    return run(() => deleteBuyIn(row.id), `${label} deleted`, () => live.mutateBuyIns());
  }

  async function editCashout(row: CashoutRow, player: Player, value: string): Promise<boolean> {
    const cents = parseMoneyInput(value);
    if (cents === null) {
      toast.error('Enter an amount — $0 if they busted');
      return false;
    }
    if (cents === row.amount_cents) return true;
    if (!(await confirm({
      title: `Change ${player.name}'s cash-out from ${money(row.amount_cents)} to ${money(cents)}?`,
      description: largeNote(cents).trim() || undefined,
      confirmLabel: 'Change it',
    }))) return false;
    return run(() => updateCashoutAmount(row.id, cents), `Cash-out changed to ${money(cents)}`, () => live.mutateCashouts());
  }

  async function removeCashout(row: CashoutRow, player: Player): Promise<boolean> {
    if (!(await confirm({
      title: `Delete ${player.name}'s ${money(row.amount_cents)} cash-out?`,
      description: 'They go back to playing; you enter their cash-out again when they leave.',
      confirmLabel: 'Delete',
      destructive: true,
    }))) return false;
    return run(() => deleteCashout(row.id), 'Cash-out deleted', () => live.mutateCashouts());
  }

  return { rebuy, cashOutEarly, editBuyIn, removeBuyIn, editCashout, removeCashout };
}

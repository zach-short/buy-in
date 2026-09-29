'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { centsToDollars, formatCents } from '@pb/core';

import { parseMoneyInput } from '@/components/ui/money-input';
import type { ConfirmOptions } from '@/hooks/use-confirm';
import { sumCents } from '@/lib/ledger';
import {
  fetchSession, fetchSessionBuyIns, fetchSessionCashouts, type CashoutRow, type PlayerRow, type SessionWithPlayers,
} from '@/lib/supabase/queries';
import { updateCashoutAmount } from '@/lib/supabase/session-edits';
import { closeSession, createCashout } from '@/lib/supabase/writes';
import { missingNames, planCashoutWrites, totalOutCents, type CashoutEntry, type CashoutWrite } from './close-plan';
import { writeFailureMessage } from './money-guards';
import { closeSummary } from './close-summary';
import type { LiveSession } from './use-live-session';

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const OFFLINE = 'No connection — nothing was closed';
const WRITTEN_NOT_CLOSED = "Cash-outs saved — couldn't mark the night closed. Try again.";

/** playerId → cents, as the database had them when the host last saw them. */
type CashoutSnapshot = Record<string, number>;

function snapshotOf(rows: readonly CashoutRow[]): CashoutSnapshot {
  return Object.fromEntries(rows.map((c) => [c.player_id, c.amount_cents]));
}

/** Players whose cash-out appeared, vanished or changed amount since the snapshot. */
function changedSince(snapshot: CashoutSnapshot, rows: readonly CashoutRow[]): string[] {
  const now = snapshotOf(rows);
  const ids = new Set([...Object.keys(snapshot), ...Object.keys(now)]);
  return [...ids].filter((id) => snapshot[id] !== now[id]);
}

function toInput(cents: number): string {
  return String(centsToDollars(cents));
}

/**
 * The cash-out screen's state and the close itself. Nothing is written until the host has
 * entered every player (busted is an explicit $0), settled any pot left over, and confirmed a
 * summary; the writes then run one player at a time against freshly read rows, so a failure
 * names who was not saved and a retry picks up exactly where it stopped.
 */
export function useCloseSession(
  session: SessionWithPlayers | null | undefined,
  seated: readonly Pick<PlayerRow, 'id' | 'name'>[],
  live: LiveSession,
  confirm: Confirm,
) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  // The pot the host said the house keeps (or covers). Only valid while it still equals the
  // pot: change any amount and the acknowledgement no longer applies.
  const [houseAckCents, setHouseAckCents] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);
  // What the cash-outs were when this screen was filled in. Closing re-reads them and refuses
  // if another device corrected one meanwhile, rather than overwriting that correction.
  const [snapshot, setSnapshot] = useState<CashoutSnapshot>({});

  const entries: CashoutEntry[] = seated.map((p) => ({ playerId: p.id, name: p.name, cents: parseMoneyInput(amounts[p.id] ?? '') }));
  const totalInCents = sumCents(live.buyIns, (b) => b.amount_cents);
  const outCents = totalOutCents(entries);
  const remainingCents = totalInCents - outCents;
  const missing = missingNames(entries);
  const potSettled = remainingCents === 0 || houseAckCents === remainingCents;
  const rosterReady = !!session && live.ledgerLoaded && seated.length === session.player_ids.length;

  function prefill() {
    const next: Record<string, string> = {};
    for (const c of live.cashouts) next[c.player_id] = toInput(c.amount_cents);
    setAmounts(next);
    setSnapshot(snapshotOf(live.cashouts));
    setHouseAckCents(null);
    setFailures([]);
  }

  function setAmount(playerId: string, value: string) {
    setAmounts((prev) => ({ ...prev, [playerId]: value }));
  }

  /** Puts the whole pot on one player's cash-out — adding what is left, or taking back an overpay. */
  function assignRemainder(playerId: string) {
    const next = (parseMoneyInput(amounts[playerId] ?? '') ?? 0) + remainingCents;
    if (next < 0) {
      toast.error('That would take their cash-out below $0 — pick someone who cashed out more');
      return;
    }
    setAmount(playerId, toInput(next));
  }

  // Run after the host confirms the summary, so nothing another device did while the dialog
  // was open slips through: the night must still be open, and the buy-ins and cash-outs must
  // be what the host was looking at. Returns the fresh cash-outs to plan against, or null.
  async function freshCashouts(sessionId: string): Promise<CashoutRow[] | null> {
    const [current, latestBuyIns, latestCashouts] = await Promise.all([
      fetchSession(sessionId), fetchSessionBuyIns(sessionId), fetchSessionCashouts(sessionId),
    ]);
    if (current?.status !== 'active') {
      toast.error('This session is already closed');
      void live.mutateSession();
      return null;
    }
    if (sumCents(latestBuyIns, (b) => b.amount_cents) !== totalInCents) {
      void live.mutateBuyIns(latestBuyIns, { revalidate: false });
      toast.error('Buy-ins changed on another device — check the pot and close again');
      return null;
    }
    const changed = changedSince(snapshot, latestCashouts);
    if (changed.length) {
      takeCashouts(latestCashouts, changed);
      const names = seated.filter((p) => changed.includes(p.id)).map((p) => p.name);
      toast.error(`Cash-outs changed on another device${names.length ? ` (${names.join(', ')})` : ''} — check and close again`);
      return null;
    }
    return latestCashouts;
  }

  // Shows the other device's values for just the players it changed; the host's other entries stay.
  function takeCashouts(rows: readonly CashoutRow[], playerIds: readonly string[]) {
    void live.mutateCashouts([...rows], { revalidate: false });
    setSnapshot(snapshotOf(rows));
    setAmounts((prev) => {
      const next = { ...prev };
      for (const id of playerIds) {
        const row = rows.find((c) => c.player_id === id);
        next[id] = row ? toInput(row.amount_cents) : '';
      }
      return next;
    });
  }

  function confirmSummary(): Promise<boolean> {
    return confirm({
      title: `Close ${session?.name ?? 'this session'}?`,
      description: closeSummary({ entries, totalInCents, outCents, remainingCents }),
      confirmLabel: 'Close session',
      cancelLabel: 'Go back',
    });
  }

  async function runWrite(sessionId: string, barId: string, write: CashoutWrite): Promise<void> {
    if (write.kind === 'insert') await createCashout({ id: sessionId, bar_id: barId }, write.playerId, write.cents);
    if (write.kind === 'update') await updateCashoutAmount(write.id, write.cents);
  }

  /** Writes every cash-out, one at a time; returns "Name: reason" for each that failed. */
  async function writeCashouts(sessionId: string, barId: string, existing: readonly CashoutRow[]): Promise<string[]> {
    const plan = planCashoutWrites(entries, existing);
    // This screen's own successful writes become the baseline, so a retry after a partial
    // failure is not mistaken for another device's change.
    const baseline = snapshotOf(existing);
    const failed: string[] = [];
    for (const write of plan) {
      try {
        await runWrite(sessionId, barId, write);
        if (write.kind !== 'keep') baseline[write.playerId] = write.cents;
      } catch (e) {
        const name = seated.find((p) => p.id === write.playerId)?.name ?? 'A player';
        failed.push(`${name}: ${writeFailureMessage(e, 'no connection')}`);
      }
    }
    setSnapshot(baseline);
    return failed;
  }

  function blockedReason(): string | null {
    // An empty or half-loaded roster would otherwise read as "everyone entered" and close the
    // night with cash-outs missing.
    if (!rosterReady) return 'Still loading the table — try again in a moment';
    if (missing.length) return `No cash-out for ${missing.join(', ')} — enter an amount or tap Busted`;
    if (!potSettled) return `Decide what happens to the $${formatCents(Math.abs(remainingCents))} ${remainingCents > 0 ? 'left in the pot' : 'overpaid'}`;
    return null;
  }

  async function close() {
    if (!session) return;
    const blocked = blockedReason();
    if (blocked) {
      toast.error(blocked);
      return;
    }
    setClosing(true);
    let written = false;
    try {
      if (!(await confirmSummary())) return;
      const existing = await freshCashouts(session.id);
      if (!existing) return;
      const failed = await writeCashouts(session.id, session.bar_id, existing);
      setFailures(failed);
      if (failed.length) {
        toast.error(`${failed.length} cash-out${failed.length === 1 ? '' : 's'} not saved — the session is still open. Try again.`);
        return;
      }
      written = true;
      await closeSession(session.id);
      router.push(`/session/${session.id}/summary`);
    } catch (e) {
      toast.error(written ? WRITTEN_NOT_CLOSED : writeFailureMessage(e, OFFLINE));
    } finally {
      void live.mutateCashouts();
      setClosing(false);
    }
  }

  return {
    amounts, setAmount, prefill, assignRemainder, close, closing, failures,
    entries, totalInCents, outCents, remainingCents, missing, potSettled,
    houseAckCents, setHouseAckCents,
  };
}

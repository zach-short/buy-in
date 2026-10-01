'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { cashoutsChangedSince, centsToDollars, formatCents, refillCashouts } from '@pb/core';

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

// `?view=cashout` marks the cash-out screen's history entry on the session page.
const VIEW_PARAM = 'view';
const CASHOUT_VIEW = 'cashout';

const OFFLINE = 'No connection — nothing was closed';
const WRITTEN_NOT_CLOSED = "Cash-outs saved — couldn't mark the night closed. Try again.";

/** playerId → cents, as the database had them when the host last saw them. */
type CashoutSnapshot = Record<string, number>;

/** A cash-out the last close failed to write: the cents it tried, and the "Name: reason" line shown. */
interface UnsavedCashout {
  playerId: string;
  cents: number;
  line: string;
}

function snapshotOf(rows: readonly CashoutRow[]): CashoutSnapshot {
  return Object.fromEntries(rows.map((c) => [c.player_id, c.amount_cents]));
}

function toInput(cents: number): string {
  return String(centsToDollars(cents));
}

function typedCents(amounts: Readonly<Record<string, string>>): Record<string, number | null> {
  return Object.fromEntries(Object.entries(amounts).map(([id, value]) => [id, parseMoneyInput(value)]));
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
  const [unsaved, setUnsaved] = useState<UnsavedCashout[]>([]);
  // What the cash-outs were when this screen was filled in. Closing re-reads them and refuses
  // if another device corrected one meanwhile, rather than overwriting that correction.
  const [snapshot, setSnapshot] = useState<CashoutSnapshot>({});

  // Cash-out is a history entry on this page rather than a route of its own, because the typed
  // amounts live in this hook and a route change would drop them. So the device back gesture
  // and the browser Back return to the table with every amount intact.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // Whether End Session has filled the screen on this visit to the page.
  const [filled, setFilled] = useState(false);
  const wantsCashout = searchParams.get(VIEW_PARAM) === CASHOUT_VIEW;
  const active = session?.status === 'active';

  // A reload (or an opened link) on the cash-out entry mounts with nothing filled, and showing
  // the screen then would show blanks where the database has cash-outs. So that entry becomes
  // the table's, and End Session fills the screen again. A reload never closes the night: only
  // the Close Session button calls close().
  useEffect(() => {
    if (wantsCashout && !filled && active) window.history.replaceState(null, '', pathname);
  }, [wantsCashout, filled, active, pathname]);

  const entries: CashoutEntry[] = seated.map((p) => ({ playerId: p.id, name: p.name, cents: parseMoneyInput(amounts[p.id] ?? '') }));
  const totalInCents = sumCents(live.buyIns, (b) => b.amount_cents);
  const outCents = totalOutCents(entries);
  const remainingCents = totalInCents - outCents;
  const missing = missingNames(entries);
  const potSettled = remainingCents === 0 || houseAckCents === remainingCents;
  const rosterReady = !!session && live.ledgerLoaded && seated.length === session.player_ids.length;

  // Runs on every End Session, not only the first, so Back then End Session again keeps what
  // the host typed (refillCashouts has the rule, and what happens to a player seated or a
  // cash-out written elsewhere between the two visits). The house acknowledgement and the
  // not-saved list are kept too: the acknowledgement lapses by itself if the refill moves the
  // pot (potSettled compares it to the pot). A not-saved line goes once the database holds the
  // amount it failed to write, whether the host re-entered it on the table or the write landed
  // though its reply was lost. Every other line stays until the next close, so a host who comes
  // back without fixing anything still sees what did not save.
  function prefill() {
    const current = snapshotOf(live.cashouts);
    const { follow, snapshot: next } = refillCashouts(snapshot, typedCents(amounts), current);
    const nextAmounts = { ...amounts };
    for (const id of follow) nextAmounts[id] = Object.hasOwn(current, id) ? toInput(current[id]) : '';
    setAmounts(nextAmounts);
    setSnapshot(next);
    setUnsaved((prev) => prev.filter((u) => !Object.hasOwn(current, u.playerId) || current[u.playerId] !== u.cents));
  }

  function openCashout() {
    // The page keeps the cash-out screen up while a close is writing (page.tsx), so End Session
    // is out of reach then. The guard stays in case another path ever calls this: refilling
    // would change amounts under a close that is writing them.
    if (!closing) prefill();
    setFilled(true);
    window.history.pushState(null, '', `?${VIEW_PARAM}=${CASHOUT_VIEW}`);
  }

  // The on-screen Back goes through history like the gesture, so the two never disagree. The
  // cash-out entry only shows once openCashout has pushed it on top of the table's (a reload
  // lands on the table, above), so one step back is always the table.
  function backToTable() {
    window.history.back();
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
    const changed = cashoutsChangedSince(snapshot, snapshotOf(latestCashouts));
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

  /** Writes every cash-out, one at a time; returns each that failed, with its "Name: reason" line. */
  async function writeCashouts(sessionId: string, barId: string, existing: readonly CashoutRow[]): Promise<UnsavedCashout[]> {
    const plan = planCashoutWrites(entries, existing);
    // This screen's own successful writes become the baseline, so a retry after a partial
    // failure is not mistaken for another device's change.
    const baseline = snapshotOf(existing);
    const failed: UnsavedCashout[] = [];
    for (const write of plan) {
      if (write.kind === 'keep') continue;
      try {
        await runWrite(sessionId, barId, write);
        baseline[write.playerId] = write.cents;
      } catch (e) {
        const name = seated.find((p) => p.id === write.playerId)?.name ?? 'A player';
        failed.push({ playerId: write.playerId, cents: write.cents, line: `${name}: ${writeFailureMessage(e, 'no connection')}` });
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
    let leaving = false;
    try {
      if (!(await confirmSummary())) return;
      const existing = await freshCashouts(session.id);
      if (!existing) return;
      const failed = await writeCashouts(session.id, session.bar_id, existing);
      setUnsaved(failed);
      if (failed.length) {
        toast.error(`${failed.length} cash-out${failed.length === 1 ? '' : 's'} not saved — the session is still open. Try again.`);
        return;
      }
      written = true;
      await closeSession(session.id);
      leaving = true;
      router.push(`/session/${session.id}/summary`);
    } catch (e) {
      toast.error(written ? WRITTEN_NOT_CLOSED : writeFailureMessage(e, OFFLINE));
    } finally {
      void live.mutateCashouts();
      // A closed night stays on the locked screen until the summary has loaded, which takes
      // seconds on slow wifi. Unlocking would hand a host who swiped back the table's controls on
      // a finished ledger, until the night reads as closed. If that navigation never lands, the
      // night reading as closed sends the page to the summary anyway (page.tsx).
      if (!leaving) setClosing(false);
    }
  }

  return {
    showingCashout: wantsCashout && filled, openCashout, backToTable,
    amounts, setAmount, assignRemainder, close, closing, failures: unsaved.map((u) => u.line),
    entries, totalInCents, outCents, remainingCents, missing, potSettled,
    houseAckCents, setHouseAckCents,
  };
}

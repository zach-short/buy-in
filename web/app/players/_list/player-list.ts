import { isSettled } from '@pb/core';

// Pure rules for the host's players list: search, balance filter, what archiving hides, last
// played and the duplicate-name warning. No React, no Supabase, so each reads on its own.

export type BalanceFilter = 'all' | 'owes' | 'owed' | 'even';

export interface PlayerListRow<Player> {
  player: Player;
  balanceCents: number;
  archived: boolean;
  /** Newest buy-in or cash-out timestamp; undefined for a player who never sat down. */
  lastPlayedAt: string | undefined;
}

/** Case-, accent- and spacing-insensitive form of a name, for matching only — never stored. */
export function foldName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function matchesSearch(name: string, query: string): boolean {
  const q = foldName(query);
  return q === '' || foldName(name).includes(q);
}

export function matchesBalance(balanceCents: number, filter: BalanceFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'even') return isSettled(balanceCents);
  if (isSettled(balanceCents)) return false;
  return filter === 'owes' ? balanceCents > 0 : balanceCents < 0;
}

// Archiving is display-only (0014): someone who still owes or is owed money stays on the list,
// tagged, so a hidden balance can never be forgotten.
export function hiddenByArchive(row: { archived: boolean; balanceCents: number }): boolean {
  return row.archived && isSettled(row.balanceCents);
}

/** playerId → newest `created_at` among the rows given (buy-ins and cash-outs already loaded). */
export function lastPlayedByPlayer(rows: readonly { player_id: string; created_at: string }[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const row of rows) {
    const seen = latest.get(row.player_id);
    if (!seen || row.created_at > seen) latest.set(row.player_id, row.created_at);
  }
  return latest;
}

export type NameClash = { kind: 'exact' | 'similar'; name: string };

// One folded name starting the other at a word boundary ("Mike" / "Mike S.") is the one-off
// guest re-added under a longer name. A bare prefix ("Al" / "Alex") would warn on strangers.
function isWordPrefix(short: string, long: string): boolean {
  return long.startsWith(short) && (long.length === short.length || long[short.length] === ' ');
}

/**
 * The existing name a new one collides with. `exact` is the same trimmed spelling, which the
 * database's unique (bar_id, name) refuses outright; `similar` is only a warning.
 */
export function findNameClash(candidate: string, existing: readonly string[]): NameClash | undefined {
  const trimmed = candidate.trim();
  const folded = foldName(candidate);
  if (!folded) return undefined;
  const exact = existing.find((name) => name.trim() === trimmed);
  if (exact) return { kind: 'exact', name: exact };
  const similar = existing.find((name) => {
    const other = foldName(name);
    return other !== '' && (isWordPrefix(folded, other) || isWordPrefix(other, folded));
  });
  return similar ? { kind: 'similar', name: similar } : undefined;
}

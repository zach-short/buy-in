import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

// Host tools for a bar's player list, backed by 0014_player_merge_archive.sql (unapplied until the
// owner applies it). The database decides what a merge may do and refuses anything ambiguous;
// this file only asks and translates the answer. Archiving is display-only: an archived player
// still counts in every balance (0014 header).

// PostgREST's "function not in the schema cache" (merge_players) and "column not in the schema
// cache" (archived_at), plus Postgres's own undefined function / column: 0014 is not applied
// where this build runs. Only these two actions touch 0014, so nothing else on the page breaks.
const MIGRATION_MISSING = new Set(['PGRST202', 'PGRST204', '42883', '42703']);

const NEEDS_MIGRATION = 'Needs database update 0014';

// 0014 raises one sentence per refusal. The words are open for the owner (R7).
const REFUSALS: Readonly<Record<string, string>> = {
  'player not found': 'That player is no longer at this table.',
  'pick two different players': 'Pick two different players.',
  'both players are linked to accounts':
    'Both players are linked to accounts. Unlink one of them first, then merge.',
  'both players cashed out of the same game':
    'Both players cashed out of the same game. Fix one of those cash-outs first, then merge.',
  'there is a payment between these two players':
    'There is a payment between these two players. Delete it first, then merge.',
  'merging is not available: a table this merge does not handle refers to players':
    "Merging isn't available right now.",
};

function failure(error: PostgrestError): Error {
  if (MIGRATION_MISSING.has(error.code)) return new Error(NEEDS_MIGRATION);
  if (!error.code) return new Error("Couldn't reach Buy-In. Check your connection and try again.");
  // Anything unmapped (e.g. 0014's balance-invariant check) gets the app's shared wording.
  return new Error(REFUSALS[error.message] ?? writeErrorMessage(error));
}

/** Folds `fromId` into `intoId` — every game, drink, buy-in, cash-out and payment — and deletes `fromId`. */
export async function mergePlayers(fromId: string, intoId: string): Promise<void> {
  const { error } = await createClient().rpc('merge_players', { p_from: fromId, p_into: intoId });
  if (error) throw failure(error);
}

/** Hides or shows a player in the host's list. Their balance and history are untouched. */
export async function setPlayerArchived(playerId: string, archived: boolean): Promise<void> {
  const { data, error } = await createClient().from('players')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', playerId).select('id');
  if (error) throw failure(error);
  // Under RLS a refused update is a silent zero-row success (0002's header), so a row that did
  // not change is reported rather than assumed.
  if (!data.length) throw new Error('That player is no longer at this table.');
}

/** Tolerates rows read before 0014 is applied, where the column is simply absent. */
// Takes any object on purpose: callers pass their own row types, and some are read before the column exists.
export function isPlayerArchived(p: object): boolean {
  return Boolean((p as { archived_at?: string | null }).archived_at);
}

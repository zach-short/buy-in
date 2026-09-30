import type { PostgrestError } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

// PASSOFF item 17 (owner, 2026-09-29): a migrated player claims their existing row from the
// standing invite link, a host approves it, and a host can undo or swap any link. Every call
// here goes to 0008_player_claim_requests.sql. Nothing links an account to a row without a
// host's decision, and a claimant never reads a row's balance or contact details before one —
// the database enforces that, not this file (0008 header, decision 1).

export type ClaimablePlayer = { id: string; name: string; hasPendingRequest: boolean };

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

export type MyClaimRequest = { id: string; playerId: string; status: ClaimStatus };

export type ClaimFailure =
  | 'invalid-invite'
  | 'already-at-table'
  | 'name-unavailable'
  | 'request-waiting'
  | 'unreachable'
  | 'unknown';

/** What the invite page needs to decide between the picker, the waiting screen and home. */
export type ClaimState =
  | { kind: 'at-table' }
  | { kind: 'open'; players: ClaimablePlayer[]; myRequest: MyClaimRequest | null }
  | { kind: 'failed'; reason: ClaimFailure };

export type ClaimResult = { ok: true } | { ok: false; reason: ClaimFailure };

/** What a host's approve or reject ended as (0008, decide_player_claim). */
export type DecideOutcome = 'approved' | 'rejected' | 'player-taken' | 'account-taken';

export type PendingClaim = {
  id: string;
  playerId: string;
  playerName: string;
  requesterEmail: string | null;
  requesterName: string | null;
  createdAt: string;
};

// 0008 raises one sentence per failure; these are its exact texts. Missing, revoked and expired
// tokens share the first, as they do for join_bar_as_player (0004), so the page never tells them
// apart.
const FAILURES: Readonly<Record<string, ClaimFailure>> = {
  'invalid or expired link': 'invalid-invite',
  'this account is already at this table': 'already-at-table',
  'that name is no longer available': 'name-unavailable',
  'this account already has a request waiting at this table': 'request-waiting',
};

// PostgREST's "function not in the schema cache": 0008 is not applied where this build runs.
// `main` is treated as auto-deploying (DESIGN.md D11), so this can ship before the owner applies
// the migration; the invite page then falls back to today's name form instead of breaking.
const FUNCTION_MISSING = 'PGRST202';

// Only Postgres sets a code; postgrest-js reports a transport failure with '' (join.ts).
function classify(error: PostgrestError): ClaimFailure {
  if (!error.code) return 'unreachable';
  return FAILURES[error.message] ?? 'unknown';
}

const DECIDE_OUTCOMES: readonly DecideOutcome[] = ['approved', 'rejected', 'player-taken', 'account-taken'];

function isOutcome(value: string): value is DecideOutcome {
  return (DECIDE_OUTCOMES as readonly string[]).includes(value);
}

function isStatus(value: string): value is ClaimStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected';
}

// A host-facing failure reads as the database's own sentence, capitalised. The words are 0008's
// and are open for the owner (R7), as every new string in this feature is.
function hostError(error: PostgrestError): Error {
  if (!error.code) return new Error("Couldn't reach Buy-In. Check your connection and try again.");
  const text = error.message;
  return new Error(`${text.charAt(0).toUpperCase()}${text.slice(1)}.`);
}

/** The picker's names, and this account's own latest request among them. */
export async function fetchClaimState(token: string): Promise<ClaimState> {
  const client = createClient();
  const { data, error } = await client.rpc('list_claimable_players', { p_token: token });
  if (error?.code === FUNCTION_MISSING) return { kind: 'open', players: [], myRequest: null };
  if (error) {
    const reason = classify(error);
    return reason === 'already-at-table' ? { kind: 'at-table' } : { kind: 'failed', reason };
  }
  const players = data.map((p) => ({ id: p.id, name: p.name, hasPendingRequest: p.has_pending_request }));
  return { kind: 'open', players, myRequest: await fetchMyRequest(players) };
}

// The claimant's own rows (claim_requests_self_read). Filtered to this account and to the names
// on this invite's list: a host also reads their own bar's requests through the staff policy, and
// a request for a row that has since been claimed has nothing left to show.
async function fetchMyRequest(players: ClaimablePlayer[]): Promise<MyClaimRequest | null> {
  const client = createClient();
  const { data: auth } = await client.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId || !players.length) return null;
  const { data, error } = await client.from('player_claim_requests').select('id, player_id, status')
    .eq('user_id', userId).in('player_id', players.map((p) => p.id))
    .order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  const row = data[0];
  if (!row || !isStatus(row.status) || row.status === 'approved') return null;
  return { id: row.id, playerId: row.player_id, status: row.status };
}

/** Asks the host to link this account to `playerId`. Safe to repeat for the same name. */
export async function requestClaim(token: string, playerId: string): Promise<ClaimResult> {
  const { error } = await createClient().rpc('request_player_claim', { p_token: token, p_player_id: playerId });
  return error ? { ok: false, reason: classify(error) } : { ok: true };
}

/** Every request waiting on this bar's hosts, oldest first. */
export async function fetchPendingClaims(barId: string): Promise<PendingClaim[]> {
  const { data, error } = await createClient().from('player_claim_requests')
    .select('id, player_id, requester_email, requester_name, created_at, players(name)')
    .eq('bar_id', barId).eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    playerName: r.players?.name ?? '',
    requesterEmail: r.requester_email,
    requesterName: r.requester_name,
    createdAt: r.created_at,
  }));
}

export async function decideClaim(requestId: string, approve: boolean): Promise<DecideOutcome> {
  const { data, error } = await createClient().rpc('decide_player_claim', { p_request_id: requestId, p_approve: approve });
  if (error) throw hostError(error);
  if (!isOutcome(data)) throw new Error(`Unexpected answer from the server: ${data}`);
  return data;
}

/** The row goes back to unclaimed; the account stops seeing it. */
export async function unlinkPlayer(playerId: string): Promise<void> {
  const { error } = await createClient().rpc('unlink_player', { p_player_id: playerId });
  if (error) throw hostError(error);
}

/** Each row takes the other's account; either side may have none. */
export async function swapPlayerAccounts(a: string, b: string): Promise<void> {
  const { error } = await createClient().rpc('swap_player_accounts', { p_a: a, p_b: b });
  if (error) throw hostError(error);
}

/** Moves the account off a duplicate with no history onto its real row, deleting the duplicate. */
export async function reassignPlayerAccount(from: string, to: string): Promise<void> {
  const { error } = await createClient().rpc('reassign_player_account', { p_from: from, p_to: to });
  if (error) throw hostError(error);
}

/**
 * Unlinks and archives a player at exactly $0.00, rejects their pending claims and replaces every
 * live table invite (0028, 0029, 0030). The database refuses a balance, a seat in tonight's game
 * or a host, each in its own sentence.
 */
export async function kickPlayer(playerId: string): Promise<void> {
  const { error } = await createClient().rpc('kick_player', { p_player_id: playerId });
  if (error) throw hostError(error);
}

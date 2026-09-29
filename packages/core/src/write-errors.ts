// What a write's failure says to the host. Phase 6 moved every write from the Go API to
// Postgres, and the screens toast whatever message a failed write carries — so without
// this, a duplicate player name would read "duplicate key value violates unique
// constraint …" where the Go API said "Player with this name already exists". Each Go
// message below is kept word for word (DESIGN.md §8.2: no copy rewrite); the one new
// message is D19's, chosen by the owner 2026-09-26.

/** The fields of a PostgREST error this reads — `PostgrestError` satisfies it. */
export interface WriteErrorLike {
  message: string;
  code?: string;
}

const EXACT: Readonly<Record<string, string>> = {
  // 0002 delete_session (D19).
  'session has orders': "Undo this session's drinks before deleting it.",
  // 0001/0002's own raises, capitalised as the Go handlers wrote them (orders.go, sessions.go).
  'drink not found': 'Drink not found',
  'order not found': 'Order not found',
  'session not found': 'Session not found',
  // 0011 create_order's guards (its stock refusal is INSUFFICIENT_STOCK below).
  'drink is archived': 'That drink is archived — restore it on the Drinks page to pour it.',
  'session is closed': 'This session is closed.',
  'player is not in this session': 'That player is not in this session.',
  // 0012/0013 link RPCs: a signed-out visitor or a dead link, not a host mistake.
  'invalid or expired link': 'This link is invalid or has expired.',
  'not an event invite': 'This link is not an event invite.',
  'reading an invite requires an authenticated user': 'Sign in to view this invite.',
  'responding requires an authenticated user': 'Sign in to respond to this invite.',
  'game was cancelled': 'This game was cancelled.',
  'payments can only be reported from your portal link': 'Open your portal link to report a payment.',
  'report not found': 'Report not found',
  'this report was already decided': 'This report was already decided.',
  // 0014 merge_players' internal-error guards: the merge rolled back, nothing changed.
  'a payment still names the merged player': 'The merge was undone: a payment still names that player.',
  'player row changed under lock': 'The merge was undone: a player changed while it ran. Try again.',
};

// 0001 create_order: 'insufficient stock for % (have % %, need %)', quantities numeric(12,3).
// The payments→sessions FK is on delete restrict (0001), so delete_session, which only checks
// orders, surfaces the raw FK violation when the night still has tagged payments.
const SESSION_HAS_PAYMENTS = /foreign key constraint "payments_session/;

// 0014 merge_players: 'merge would change the combined balance (% before, % after)'.
const MERGE_BALANCE = /^merge would change the combined balance/;

const INSUFFICIENT_STOCK = /^insufficient stock for (.+) \(have (\S+) (.+), need (\S+)\)$/;

/** The Go API's `fmt.Sprintf("Insufficient stock for %s (have %.2f %s, need %.2f)")` (orders.go). */
function insufficientStock(match: RegExpMatchArray): string {
  const [, name, have, unit, need] = match;
  return `Insufficient stock for ${name} (have ${Number(have).toFixed(2)} ${unit}, need ${Number(need).toFixed(2)})`;
}

/** The message a screen should show for a failed write; unknown errors pass through unchanged. */
export function writeErrorMessage(error: WriteErrorLike): string {
  if (error.code === '23505' && error.message.includes('players_bar_name_uniq')) {
    return 'Player with this name already exists';
  }
  if (error.code === '23503' && SESSION_HAS_PAYMENTS.test(error.message)) {
    return "Remove this night's payments before deleting it.";
  }
  if (MERGE_BALANCE.test(error.message)) return 'The merge was undone: it would have changed the combined balance.';
  const stock = error.message.match(INSUFFICIENT_STOCK);
  if (stock) return insufficientStock(stock);
  return EXACT[error.message] ?? error.message;
}

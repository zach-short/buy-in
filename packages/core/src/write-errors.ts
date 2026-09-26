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
};

// 0001 create_order: 'insufficient stock for % (have % %, need %)', quantities numeric(12,3).
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
  const stock = error.message.match(INSUFFICIENT_STOCK);
  if (stock) return insufficientStock(stock);
  return EXACT[error.message] ?? error.message;
}

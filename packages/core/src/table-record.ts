/** A table the account holds a player row at — one row of get_my_tables (0010). */
export interface SeatLike {
  barId: string;
  barName: string;
}

/**
 * One session the account played — one row of get_my_performance (0004). `net_cents` is the
 * player's own way round, **positive means they won**: the opposite of computeBalanceCents.
 */
export interface PlayedLike {
  bar_id: string;
  played_on: string;
  net_cents: number;
}

/** A member's record at one table: games played there and their net, won-positive. */
export interface TableRecord {
  barId: string;
  barName: string;
  games: number;
  netCents: number;
  /** null for a table joined but not yet played at. */
  lastPlayedOn: string | null;
}

function recordFor(seat: SeatLike, played: readonly PlayedLike[]): TableRecord {
  const here = played.filter((row) => row.bar_id === seat.barId);
  const netCents = here.reduce((sum, row) => sum + row.net_cents, 0);
  const lastPlayedOn = here.reduce<string | null>(
    (latest, row) => (latest === null || Date.parse(row.played_on) > Date.parse(latest) ? row.played_on : latest),
    null,
  );
  return { barId: seat.barId, barName: seat.barName, games: here.length, netCents, lastPlayedOn };
}

// Newest activity first (member-home SCOPE.md §3 O3); a table not yet played at sorts after
// every played one, by name, so a fresh joiner still sees it.
function byActivity(a: TableRecord, b: TableRecord): number {
  if (a.lastPlayedOn && b.lastPlayedOn) return Date.parse(b.lastPlayedOn) - Date.parse(a.lastPlayedOn);
  if (a.lastPlayedOn) return -1;
  if (b.lastPlayedOn) return 1;
  return a.barName.localeCompare(b.barName);
}

/**
 * One record per seat. The seats decide which tables are listed, so a session at a table
 * the account no longer sits at never adds a card; the sessions only fill each card in.
 */
export function tableRecords(seats: readonly SeatLike[], played: readonly PlayedLike[]): TableRecord[] {
  return seats.map((seat) => recordFor(seat, played)).sort(byActivity);
}

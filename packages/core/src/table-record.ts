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

/** One row of get_my_upcoming_games (0022): the soonest game at one table, and the caller's answer. */
export interface NextGameLike {
  bar_id: string;
  game_id: string;
  name: string;
  scheduled_at: string;
  my_status: string | null;
}

export type RsvpAnswer = 'yes' | 'no' | 'maybe';

export interface NextGame {
  gameId: string;
  name: string;
  scheduledAt: string;
  /** null until the member answers — through the card or the host's texted link. */
  myStatus: RsvpAnswer | null;
}

export interface TableWithGame extends TableRecord {
  /** null when the table has nothing scheduled inside the window. */
  nextGame: NextGame | null;
}

// The column is plain text with a check constraint, so anything else reads as no answer.
function toAnswer(status: string | null): RsvpAnswer | null {
  return status === 'yes' || status === 'no' || status === 'maybe' ? status : null;
}

function toNextGame(row: NextGameLike): NextGame {
  return { gameId: row.game_id, name: row.name, scheduledAt: row.scheduled_at, myStatus: toAnswer(row.my_status) };
}

/**
 * Each record with its table's next game. The records decide which tables are listed, as the
 * seats do in tableRecords, so a game at a table without a card is never shown.
 */
export function withNextGames(records: readonly TableRecord[], games: readonly NextGameLike[]): TableWithGame[] {
  const byBar = new Map(games.map((row) => [row.bar_id, toNextGame(row)]));
  return records.map((record) => ({ ...record, nextGame: byBar.get(record.barId) ?? null }));
}

import { formatCents } from './money';

// A player's P&L has two sources (logged-sessions DESIGN.md D2): the home games
// get_my_performance returns (0004), and the games they logged themselves (0021). Both become
// one PokerResult here, so the screen draws one list, one chart and one net.
//
// netCents is the player's own way round, **positive means they won** — the same sign as
// get_my_performance and the OPPOSITE of computeBalanceCents. A logged row's net is cash-out
// minus buy-in, never the reverse.

/** Where a result came from: a host's table, or the player's own log. */
export type ResultSource = 'home' | 'logged';

/** The poker tab's source filter (PLAN.md BD-5): absent from the URL means all. */
export type SourceFilter = 'all' | ResultSource;

/** One row of get_my_performance (0004), by shape. */
export interface PerformanceLike {
  bar_id: string;
  bar_name: string;
  session_id: string;
  session_name: string;
  played_on: string;
  stakes_cents: number;
  net_cents: number;
}

/** One row of logged_sessions (0021), by shape. */
export interface LoggedLike {
  id: string;
  played_on: string;
  venue: string;
  small_blind_cents: number;
  big_blind_cents: number;
  straddle_cents: number | null;
  game_format: string | null;
  buy_in_cents: number;
  cash_out_cents: number;
  minutes_played: number | null;
  note: string | null;
}

interface ResultBase {
  id: string;
  /** The table's name for a home game, the venue for a logged one. */
  place: string;
  playedOn: string;
  netCents: number;
}

export interface HomeResult extends ResultBase {
  source: 'home';
  barId: string;
  sessionName: string;
  /** The bar's CURRENT default buy-in, not that night's stakes (0004); game-stakes fixes it. */
  stakesCents: number;
}

export interface LoggedResult extends ResultBase {
  source: 'logged';
  smallBlindCents: number;
  bigBlindCents: number;
  straddleCents: number | null;
  gameFormat: string | null;
  minutes: number | null;
}

export type PokerResult = HomeResult | LoggedResult;

export function resultsFromPerformance(rows: readonly PerformanceLike[]): HomeResult[] {
  return rows.map((row) => ({
    source: 'home',
    id: row.session_id,
    place: row.bar_name,
    playedOn: row.played_on,
    netCents: row.net_cents,
    barId: row.bar_id,
    sessionName: row.session_name,
    stakesCents: row.stakes_cents,
  }));
}

/** Net is cash-out minus buy-in: in $300, out $500 is +$200. */
export function resultsFromLogged(rows: readonly LoggedLike[]): LoggedResult[] {
  return rows.map((row) => ({
    source: 'logged',
    id: row.id,
    place: row.venue,
    playedOn: row.played_on,
    netCents: row.cash_out_cents - row.buy_in_cents,
    smallBlindCents: row.small_blind_cents,
    bigBlindCents: row.big_blind_cents,
    straddleCents: row.straddle_cents,
    gameFormat: row.game_format,
    minutes: row.minutes_played,
  }));
}

// Oldest first, as get_my_performance orders (the cumulative chart runs left to right). The id
// breaks a same-instant tie so the order, and so the running total's path, is stable.
function byPlayedOn(a: PokerResult, b: PokerResult): number {
  const byTime = Date.parse(a.playedOn) - Date.parse(b.playedOn);
  return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
}

export function mergeResults(home: readonly HomeResult[], logged: readonly LoggedResult[]): PokerResult[] {
  return [...home, ...logged].sort(byPlayedOn);
}

/**
 * A table (member-home's `?table=`) means that table's home games only, whatever the source
 * filter says: a logged game is at no table (PLAN.md BD-5).
 */
export function filterResults(
  rows: readonly PokerResult[],
  { source, table }: { source: SourceFilter; table: string | null },
): PokerResult[] {
  if (table) return rows.filter((row) => row.source === 'home' && row.barId === table);
  if (source === 'all') return [...rows];
  return rows.filter((row) => row.source === source);
}

/** Won-positive cents per hour, rounded to the cent; null without hours (DESIGN.md D4). */
export function centsPerHour(netCents: number, minutes: number | null): number | null {
  if (!minutes) return null;
  return Math.round((netCents * 60) / minutes);
}

// $2 rather than $2.00: blinds are read off a placard, and "$2.00/$5.00" is noise. A part-dollar
// blind keeps its cents ($0.25).
function blindDollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${formatCents(cents)}`;
}

/** `$2/$5`, `$0.25/$0.50`, `$2/$5/$10` with a straddle. */
export function formatBlinds(smallCents: number, bigCents: number, straddleCents: number | null): string {
  const blinds = [smallCents, bigCents, ...(straddleCents ? [straddleCents] : [])];
  return blinds.map(blindDollars).join('/');
}

export type HoursParse = { kind: 'empty' } | { kind: 'minutes'; minutes: number } | { kind: 'invalid' };

/**
 * Hours as typed (`4.5`) to whole minutes (`270`), PLAN.md BD-7. Blank is `empty`, not zero.
 * Zero, negatives, non-numbers and anything above `maxHours` are `invalid` — the cap catches
 * `300` typed for `3.00`.
 */
export function hoursToMinutes(text: string, maxHours: number): HoursParse {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' };
  if (!/^\d*\.?\d+$/.test(trimmed)) return { kind: 'invalid' };
  const minutes = Math.round(Number(trimmed) * 60);
  if (minutes <= 0 || minutes > maxHours * 60) return { kind: 'invalid' };
  return { kind: 'minutes', minutes };
}

/**
 * A picked day (`YYYY-MM-DD`, what a date input gives) as local noon, ISO (PLAN.md BD-4). A bare
 * date parses as UTC midnight and renders a day early west of UTC (0001's BD-2); noon keeps the
 * same calendar day for any offset within ±11 hours. Throws on anything that is not a real date.
 */
export function playedOnFromLocalDate(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`Not a date: ${day}`);
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const noon = new Date(year, month - 1, date, 12);
  if (noon.getFullYear() !== year || noon.getMonth() !== month - 1 || noon.getDate() !== date) {
    throw new Error(`Not a date: ${day}`);
  }
  return noon.toISOString();
}

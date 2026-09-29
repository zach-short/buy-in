import type { Json } from './database.types';
import { EVENT_TYPES, POKER_TYPE, parseEventDetails, typeLabel, type EventDetails, type TypeOption } from './event-types';
import type { PokerResult } from './logged-session';
import { formatCents } from './money';

// The Everything tab's one shape (log-events PLAN.md BD-2): poker's two sources and every logged
// event become an EverythingRow, so the chart, the list, the breakdown and the filter each know
// one shape, not three.
//
// netCents is the player's own way round, **positive means they won**, as PokerResult's is. An
// event's net is payout minus stake, never the reverse: backwards is wrong by exactly twice the
// amount and passes every gate (SCOPE H1), which is why event-result.test.ts pins it.

/** One row of logged_events (0027), by shape. */
export interface EventLike {
  id: string;
  event_type: string;
  played_on: string;
  place: string | null;
  title: string | null;
  stake_cents: number;
  payout_cents: number;
  minutes_played: number | null;
  note: string | null;
  details: Json;
}

export interface EverythingRow {
  /** Unique across sources: `home:`, `logged:` or `event:` plus the row's id. */
  key: string;
  /** POKER_TYPE for both poker sources, else the stored slug, known to the registry or not. */
  type: string;
  /** Null for an event logged without one; the screen falls back to the type's label. */
  place: string | null;
  playedOn: string;
  netCents: number;
  detail: string;
  /** Where tapping the row goes; null for a home game, which is the host's ledger (0021 D7). */
  href: string | null;
  minutes: number | null;
}

export interface TypeTotal extends TypeOption {
  netCents: number;
  entries: number;
}

/** Payout minus stake: put in $10, got back $20 is +$10; a free bet of $0 back $25 is +$25. */
export function eventNetCents(stakeCents: number, payoutCents: number): number {
  return payoutCents - stakeCents;
}

// $25 rather than $25.00: a table minimum is read off a placard, as blinds are (formatBlinds).
function wholeDollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${formatCents(cents)}`;
}

function signedOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function extrasLine(details: EventDetails): string[] {
  const parts = [details.sport, details.betType];
  if (details.americanOdds !== undefined) parts.push(signedOdds(details.americanOdds));
  if (details.tableMinCents !== undefined) parts.push(`${wholeDollars(details.tableMinCents)} min`);
  return parts.filter((part): part is string => Boolean(part));
}

/**
 * The line under the place: the title, then the type's extras — `NFL · spread · -110`,
 * `$25 min`, or `''`. A `details` that fails its schema shows no extras and never throws (H4).
 */
export function eventDetail(row: EventLike): string {
  const details = parseEventDetails(row.event_type, row.details);
  const parts = [row.title, ...(details ? extrasLine(details) : [])];
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}

export function rowsFromEvents(rows: readonly EventLike[]): EverythingRow[] {
  return rows.map((row) => ({
    key: `event:${row.id}`,
    type: row.event_type,
    place: row.place,
    playedOn: row.played_on,
    netCents: eventNetCents(row.stake_cents, row.payout_cents),
    detail: eventDetail(row),
    href: `/results/event/${row.id}`,
    minutes: row.minutes_played,
  }));
}

/**
 * Poker's rows, already netted won-positive by logged-session.ts. The detail line is the web's
 * `resultDetail`, passed in, so the Everything list reads a poker row exactly as My poker does.
 */
export function rowsFromPoker(results: readonly PokerResult[], detail: (row: PokerResult) => string): EverythingRow[] {
  return results.map((row) => ({
    key: `${row.source}:${row.id}`,
    type: POKER_TYPE,
    place: row.place,
    playedOn: row.playedOn,
    netCents: row.netCents,
    detail: detail(row),
    href: row.source === 'logged' ? `/results/log/${row.id}` : null,
    minutes: row.source === 'logged' ? row.minutes : null,
  }));
}

// Oldest first, for a chart that runs left to right. The key breaks a same-instant tie so the
// order, and so the running total's path, does not depend on which read answered first.
function byPlayedOn(a: EverythingRow, b: EverythingRow): number {
  const byTime = Date.parse(a.playedOn) - Date.parse(b.playedOn);
  if (byTime !== 0) return byTime;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

export function mergeEverything(poker: readonly EverythingRow[], events: readonly EverythingRow[]): EverythingRow[] {
  return [...poker, ...events].sort(byPlayedOn);
}

/** `'all'`, or one type's rows; `poker` covers home games and logged sessions alike (BD-6). */
export function filterByType(rows: readonly EverythingRow[], type: string): EverythingRow[] {
  if (type === 'all') return [...rows];
  return rows.filter((row) => row.type === type);
}

// Poker first, then the registry's order, then slugs it no longer knows, alphabetically.
function typeRank(slug: string): number {
  if (slug === POKER_TYPE) return -1;
  const index = EVENT_TYPES.findIndex((type) => type.slug === slug);
  return index === -1 ? EVENT_TYPES.length : index;
}

function presentTypes(rows: readonly EverythingRow[]): string[] {
  const slugs = [...new Set(rows.map((row) => row.type))];
  return slugs.sort((a, b) => typeRank(a) - typeRank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/** The filter's chips: only types the player has logged (SCOPE Dial 8). */
export function typeChips(rows: readonly EverythingRow[]): TypeOption[] {
  return presentTypes(rows).map((slug) => ({ slug, label: typeLabel(slug) }));
}

/** Each present type's net and count. The nets sum to the rows' total, unknown slugs included. */
export function breakdownByType(rows: readonly EverythingRow[]): TypeTotal[] {
  return presentTypes(rows).map((slug) => {
    const own = rows.filter((row) => row.type === slug);
    const netCents = own.reduce((sum, row) => sum + row.netCents, 0);
    return { slug, label: typeLabel(slug), netCents, entries: own.length };
  });
}

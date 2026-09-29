'use client';

import { useState, useSyncExternalStore } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { centsPerHour, centsToDollars, hoursToMinutes, playedOnFromLocalDate } from '@pb/core';
import { parseMoneyInput } from '@/components/ui/money-input';
import { localDateValue } from '@/hooks/use-schedule-game';
import { LOGGED_SESSION_MAX_HOURS, LOGGED_SESSION_SUGGESTIONS } from '@/lib/config';
import {
  createLoggedSession,
  deleteLoggedSession,
  fetchMyLoggedSessions,
  updateLoggedSession,
  type LoggedSessionInput,
  type LoggedSessionRow,
} from '@/lib/supabase/logged-sessions';

/** Every field as typed. Money is the MoneyInput string: blank is "not entered", never $0. */
export interface LogSessionFields {
  venue: string;
  date: string;
  small: string;
  big: string;
  straddle: string;
  game: string;
  buyIn: string;
  cashOut: string;
  hours: string;
  note: string;
}

export type LogSessionField = keyof LogSessionFields;

export interface LogSessionForm {
  fields: LogSessionFields;
  set: (field: LogSessionField, value: string) => void;
  setBlinds: (smallCents: number, bigCents: number) => void;
  /** The latest pickable date: a logged session has already happened (DESIGN.md §4). */
  today: string;
  /** Why a typed value cannot be saved, per field. A blank required field only disables Save. */
  problems: Partial<Record<LogSessionField, string>>;
  /** Out for minus in for, once both are typed — the sign is visible before saving (H4). */
  netCents: number | null;
  perHourCents: number | null;
  venues: string[];
  games: string[];
  canSave: boolean;
  busy: boolean;
  save: () => Promise<void>;
  remove: () => Promise<void>;
}

// BD-3: the player's own past formats, then the two a casino is most likely to spread.
const COMMON_GAMES = ['NLH', 'PLO'];

// Local 'today' from the browser, '' on the server (use-schedule-game.ts has the reason).
const subscribeNever = () => () => {};

function useLocalToday(): string {
  return useSyncExternalStore(subscribeNever, () => localDateValue(new Date()), () => '');
}

function moneyText(cents: number | null): string {
  return cents === null ? '' : String(centsToDollars(cents));
}

// Minutes back to what the player typed: 270 is "4.5". Two places is exact enough that
// hoursToMinutes turns the text back into the same whole minutes.
function hoursText(minutes: number | null): string {
  return minutes === null ? '' : String(Math.round((minutes / 60) * 100) / 100);
}

function fieldsFrom(row: LoggedSessionRow | undefined): LogSessionFields {
  return {
    venue: row?.venue ?? '',
    date: row ? localDateValue(new Date(row.played_on)) : '',
    small: moneyText(row?.small_blind_cents ?? null),
    big: moneyText(row?.big_blind_cents ?? null),
    straddle: moneyText(row?.straddle_cents ?? null),
    game: row?.game_format ?? '',
    buyIn: moneyText(row?.buy_in_cents ?? null),
    cashOut: moneyText(row?.cash_out_cents ?? null),
    hours: hoursText(row?.minutes_played ?? null),
    note: row?.note ?? '',
  };
}

/** Distinct, newest first, capped at the dial; case-insensitive so "rivers" and "Rivers" are one. */
function recentDistinct(values: readonly (string | null)[]): string[] {
  const seen = new Map<string, string>();
  for (const value of [...values].reverse()) {
    if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
  }
  return [...seen.values()].slice(0, LOGGED_SESSION_SUGGESTIONS);
}

function withCommonGames(own: string[]): string[] {
  const missing = COMMON_GAMES.filter((g) => !own.some((o) => o.toLowerCase() === g.toLowerCase()));
  return [...own, ...missing];
}

interface Parsed {
  small: number | null;
  big: number | null;
  straddle: number | null;
  buyIn: number | null;
  cashOut: number | null;
  hours: ReturnType<typeof hoursToMinutes>;
}

function parse(f: LogSessionFields): Parsed {
  return {
    small: parseMoneyInput(f.small),
    big: parseMoneyInput(f.big),
    straddle: parseMoneyInput(f.straddle),
    buyIn: parseMoneyInput(f.buyIn),
    cashOut: parseMoneyInput(f.cashOut),
    hours: hoursToMinutes(f.hours, LOGGED_SESSION_MAX_HOURS),
  };
}

// Each mirrors a check on logged_sessions (0021), so the table never has to refuse a save.
function findProblems(f: LogSessionFields, p: Parsed, today: string): Partial<Record<LogSessionField, string>> {
  const problems: Partial<Record<LogSessionField, string>> = {};
  if (today && f.date > today) problems.date = 'That day hasn’t happened yet';
  if (p.small === 0) problems.small = 'Blinds must be more than $0';
  if (p.small && p.big !== null && p.big < p.small) problems.big = 'Can’t be less than the small blind';
  if (f.straddle.trim() && !p.straddle) problems.straddle = 'Leave it blank, or more than $0';
  if (p.buyIn === 0) problems.buyIn = 'Must be more than $0';
  if (p.hours.kind === 'invalid') problems.hours = `Between 0 and ${LOGGED_SESSION_MAX_HOURS} hours`;
  return problems;
}

// Null until every required field is readable and nothing is wrong. "Out for" blank is null
// here, never 0: a typed 0 is a real bust, a blank one is not yet entered.
function toInput(f: LogSessionFields, p: Parsed, clean: boolean): LoggedSessionInput | null {
  if (!clean || !f.venue.trim() || !f.date) return null;
  if (!p.small || !p.big || !p.buyIn || p.cashOut === null) return null;
  return {
    venue: f.venue.trim(),
    played_on: playedOnFromLocalDate(f.date),
    small_blind_cents: p.small,
    big_blind_cents: p.big,
    straddle_cents: p.straddle || null,
    game_format: f.game.trim() || null,
    buy_in_cents: p.buyIn,
    cash_out_cents: p.cashOut,
    minutes_played: p.hours.kind === 'minutes' ? p.hours.minutes : null,
    note: f.note.trim() || null,
  };
}

/**
 * The log form's state and writes (logged-sessions PLAN.md phase 2). `existing` is the row being
 * edited; without it the form logs a new one. After a save or a delete the caller navigates;
 * this revalidates 'logged_sessions', the key the poker tab reads (use-poker-results.ts).
 */
export function useLogSessionForm(existing?: LoggedSessionRow): LogSessionForm {
  const today = useLocalToday();
  const [typed, setTyped] = useState(() => fieldsFrom(existing));
  const [busy, setBusy] = useState(false);
  const { mutate } = useSWRConfig();
  const { data: past = [] } = useSWR('logged_sessions', fetchMyLoggedSessions);

  // A new log's date shows today without an effect copying it in, once the browser knows it.
  const fields = { ...typed, date: typed.date || today };
  const parsed = parse(fields);
  const problems = findProblems(fields, parsed, today);
  const input = toInput(fields, parsed, Object.keys(problems).length === 0);
  const netCents = parsed.buyIn !== null && parsed.cashOut !== null ? parsed.cashOut - parsed.buyIn : null;

  function write(): Promise<void> {
    if (input === null) return Promise.reject(new Error('Fill in the required fields'));
    return existing ? updateLoggedSession(existing.id, input) : createLoggedSession(input);
  }

  // After an edit the edit page's own key is refreshed too: its form takes its fields from the
  // cached row once, so a stale row would reopen showing the old numbers. After a delete it is
  // left alone, or the page would flash "not found" before the caller navigates away.
  async function run(change: () => Promise<void>, refreshRow: boolean): Promise<void> {
    setBusy(true);
    try {
      await change();
      await mutate('logged_sessions');
      if (existing && refreshRow) await mutate(['logged_session', existing.id]);
    } finally {
      setBusy(false);
    }
  }

  return {
    fields,
    set: (field, value) => setTyped((prev) => ({ ...prev, [field]: value })),
    setBlinds: (smallCents, bigCents) => setTyped((prev) => ({ ...prev, small: moneyText(smallCents), big: moneyText(bigCents) })),
    today,
    problems,
    netCents,
    perHourCents: netCents === null || parsed.hours.kind !== 'minutes' ? null : centsPerHour(netCents, parsed.hours.minutes),
    venues: recentDistinct(past.map((row) => row.venue)),
    games: withCommonGames(recentDistinct(past.map((row) => row.game_format))),
    canSave: input !== null && !busy,
    busy,
    save: () => run(write, true),
    remove: () => run(() => (existing ? deleteLoggedSession(existing.id) : Promise.resolve()), false),
  };
}

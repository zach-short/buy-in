'use client';

import { useState, useSyncExternalStore } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import {
  centsPerHour,
  centsToDollars,
  eventNetCents,
  hoursToMinutes,
  parseAmericanOdds,
  parseEventDetails,
  playedOnFromLocalDate,
  type EventDetails,
  type EventType,
} from '@pb/core';
import { parseMoneyInput } from '@/components/ui/money-input';
import { localDateValue } from '@/hooks/use-schedule-game';
import { LOGGED_SESSION_MAX_HOURS, LOGGED_SESSION_SUGGESTIONS } from '@/lib/config';
import {
  createLoggedEvent,
  deleteLoggedEvent,
  fetchMyLoggedEvents,
  updateLoggedEvent,
  type LoggedEventInput,
  type LoggedEventRow,
} from '@/lib/supabase/logged-events';

type BaseField = 'place' | 'title' | 'date' | 'stake' | 'payout' | 'hours' | 'note';
type ExtraKey = keyof EventDetails;

/** Every field as typed. Money is the MoneyInput string: blank is "not entered", never $0. */
export type LogEventField = BaseField | ExtraKey;
export type LogEventFields = Record<LogEventField, string>;

export interface LogEventForm {
  type: EventType;
  fields: LogEventFields;
  set: (field: LogEventField, value: string) => void;
  /** The latest pickable date: a logged event has already happened. */
  today: string;
  /** Why a typed value cannot be saved, per field. A blank required field only disables Save. */
  problems: Partial<Record<LogEventField, string>>;
  /** Got back minus put in, once both are typed — the sign is visible before saving (SCOPE H1). */
  netCents: number | null;
  perHourCents: number | null;
  places: string[];
  canSave: boolean;
  busy: boolean;
  save: () => Promise<void>;
  remove: () => Promise<void>;
}

// log-events SCOPE Dial 4: Other's own name is capped where poker's game_format is (0021). The
// table allows a title of 100, so this form is the only place the 40 is kept (HANDOFF step 66).
export const EVENT_TITLE_MAX = 40;

// Local 'today' from the browser, '' on the server (use-schedule-game.ts has the reason).
const subscribeNever = () => () => {};

function useLocalToday(): string {
  return useSyncExternalStore(subscribeNever, () => localDateValue(new Date()), () => '');
}

function moneyText(cents: number | null | undefined): string {
  return cents == null ? '' : String(centsToDollars(cents));
}

// Minutes back to what the player typed: 270 is "4.5". Two places is exact enough that
// hoursToMinutes turns the text back into the same whole minutes.
function hoursText(minutes: number | null): string {
  return minutes === null ? '' : String(Math.round((minutes / 60) * 100) / 100);
}

function oddsText(odds: number | undefined): string {
  if (odds === undefined) return '';
  return odds > 0 ? `+${odds}` : String(odds);
}

// A stored details that fails its schema shows blank extras rather than throwing (SCOPE H4).
function fieldsFrom(type: EventType, row: LoggedEventRow | undefined): LogEventFields {
  const details = row ? parseEventDetails(type.slug, row.details) ?? {} : {};
  return {
    place: row?.place ?? '',
    title: row?.title ?? '',
    date: row ? localDateValue(new Date(row.played_on)) : '',
    stake: moneyText(row?.stake_cents),
    payout: moneyText(row?.payout_cents),
    hours: hoursText(row?.minutes_played ?? null),
    note: row?.note ?? '',
    tableMinCents: moneyText(details.tableMinCents),
    sport: details.sport ?? '',
    betType: details.betType ?? '',
    americanOdds: oddsText(details.americanOdds),
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

interface Parsed {
  stake: number | null;
  payout: number | null;
  hours: ReturnType<typeof hoursToMinutes>;
  tableMin: number | null;
  odds: ReturnType<typeof parseAmericanOdds>;
}

function parse(f: LogEventFields): Parsed {
  return {
    stake: parseMoneyInput(f.stake),
    payout: parseMoneyInput(f.payout),
    hours: hoursToMinutes(f.hours, LOGGED_SESSION_MAX_HOURS),
    tableMin: parseMoneyInput(f.tableMinCents),
    odds: parseAmericanOdds(f.americanOdds),
  };
}

// Each mirrors a check on logged_events (0027) or the type's zod schema, so neither has to
// refuse a save. "Both $0" is the table's amount check; one $0 is a free bet or a real loss.
function findProblems(f: LogEventFields, p: Parsed, today: string): Partial<Record<LogEventField, string>> {
  const problems: Partial<Record<LogEventField, string>> = {};
  if (today && f.date > today) problems.date = 'That day hasn’t happened yet';
  if (f.title.trim().length > EVENT_TITLE_MAX) problems.title = `At most ${EVENT_TITLE_MAX} characters`;
  if (p.stake === 0 && p.payout === 0) problems.payout = 'Both can’t be $0';
  if (p.hours.kind === 'invalid') problems.hours = `Between 0 and ${LOGGED_SESSION_MAX_HOURS} hours`;
  if (f.tableMinCents.trim() && !p.tableMin) problems.tableMinCents = 'Leave it blank, or more than $0';
  if (p.odds.kind === 'invalid') problems.americanOdds = 'Like -110 or +150';
  return problems;
}

function detailsFrom(type: EventType, f: LogEventFields, p: Parsed): EventDetails {
  const all: EventDetails = {
    tableMinCents: p.tableMin ?? undefined,
    sport: f.sport.trim() || undefined,
    betType: f.betType.trim() || undefined,
    americanOdds: p.odds.kind === 'odds' ? p.odds.odds : undefined,
  };
  const shown = new Set(type.extras.map((extra) => extra.key));
  return Object.fromEntries(Object.entries(all).filter(([key, value]) => shown.has(key as ExtraKey) && value !== undefined));
}

function hasRequired(type: EventType, f: LogEventFields): boolean {
  if (!f.date) return false;
  if (type.placeRequired && !f.place.trim()) return false;
  return !type.titleRequired || f.title.trim() !== '';
}

// Null until every required field is readable and nothing is wrong. "Got back" blank is null
// here, never 0: a typed 0 is a real loss, a blank one is not yet entered.
function toInput(type: EventType, f: LogEventFields, p: Parsed, clean: boolean): LoggedEventInput | null {
  if (!clean || !hasRequired(type, f) || p.stake === null || p.payout === null) return null;
  const details = detailsFrom(type, f, p);
  if (!type.details.safeParse(details).success) return null;
  return {
    event_type: type.slug,
    played_on: playedOnFromLocalDate(f.date),
    place: f.place.trim() || null,
    title: type.titleRequired ? f.title.trim() : null,
    stake_cents: p.stake,
    payout_cents: p.payout,
    minutes_played: type.asksHours && p.hours.kind === 'minutes' ? p.hours.minutes : null,
    note: f.note.trim() || null,
    details: { ...details },
  };
}

/**
 * The event form's state and writes (log-events PLAN.md phase 2 step 3). `existing` is the row
 * being edited; without it the form logs a new one of `type`. After a save or a delete the
 * caller navigates; this revalidates 'logged_events', the key the Everything tab reads
 * (use-everything-results.ts).
 */
export function useLogEventForm(type: EventType, existing?: LoggedEventRow): LogEventForm {
  const today = useLocalToday();
  const [typed, setTyped] = useState(() => fieldsFrom(type, existing));
  const [busy, setBusy] = useState(false);
  const { mutate } = useSWRConfig();
  const { data: past = [] } = useSWR('logged_events', fetchMyLoggedEvents);

  // A new log's date shows today without an effect copying it in, once the browser knows it.
  const fields = { ...typed, date: typed.date || today };
  const parsed = parse(fields);
  const problems = findProblems(fields, parsed, today);
  const input = toInput(type, fields, parsed, Object.keys(problems).length === 0);
  const netCents = parsed.stake !== null && parsed.payout !== null ? eventNetCents(parsed.stake, parsed.payout) : null;
  const minutes = type.asksHours && parsed.hours.kind === 'minutes' ? parsed.hours.minutes : null;

  function write(): Promise<void> {
    if (input === null) return Promise.reject(new Error('Fill in the required fields'));
    return existing ? updateLoggedEvent(existing.id, input) : createLoggedEvent(input);
  }

  // As use-log-session-form.ts: after an edit the edit page's own key is refreshed too, and
  // after a delete it is left alone so the page does not flash "not found" before leaving.
  async function run(change: () => Promise<void>, refreshRow: boolean): Promise<void> {
    setBusy(true);
    try {
      await change();
      await mutate('logged_events');
      if (existing && refreshRow) await mutate(['logged_event', existing.id]);
    } finally {
      setBusy(false);
    }
  }

  return {
    type,
    fields,
    set: (field, value) => setTyped((prev) => ({ ...prev, [field]: value })),
    today,
    problems,
    netCents,
    perHourCents: netCents === null || minutes === null ? null : centsPerHour(netCents, minutes),
    places: recentDistinct(past.filter((row) => row.event_type === type.slug).map((row) => row.place)),
    canSave: input !== null && !busy,
    busy,
    save: () => run(write, true),
    remove: () => run(() => (existing ? deleteLoggedEvent(existing.id) : Promise.resolve()), false),
  };
}

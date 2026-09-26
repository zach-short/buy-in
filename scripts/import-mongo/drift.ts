import type { Json } from '@pb/core';

import type { BarTarget } from './bar';
import { CLEAR_ORDER, type ClearedTable, type Plan } from './load';
import { takeSnapshot, type Row } from './snapshot';
import type { Db } from './supabase';
import type { ImportRows } from './transform';

// The guard in front of every write to an existing bar; it picks load.ts's Plan. D9's
// truncate-and-reload is needed only when the bar holds something other than what this
// run writes (an empty bar needs no truncate, an identical one no reload), and that is
// exactly when it destroys something: an order entered or deleted through the app, a
// paid flag, a phone number, a claimed player, a recipe, a share link texted to a
// player, the bar's own name or handle — deleted or silently reverted. So before the
// first write, every row of all twelve tables is compared column by column with what
// this run builds from Mongo, and the bar row with what this run would set. Any
// difference refuses the run unless --force is given.
//
// "Exactly what this run writes" is computed from Mongo as it is now, not remembered
// from the last run. The build is deterministic (ids.ts), so the two agree while Mongo is
// unchanged. If Mongo has changed since, the guard refuses as well and cannot say which
// side moved; it errs toward refusing.
//
// Output names tables, columns and row keys only: never a value, and never a link's
// token, which is a working credential to a real ledger.

/** The columns that identify a row. Typed from CLEAR_ORDER, so a cleared table cannot lack one. */
const KEYS: Record<ClearedTable, readonly string[]> = {
  player_share_links: ['token'],
  player_claim_links: ['token'],
  orders: ['id'],
  buy_ins: ['id'],
  cashouts: ['id'],
  payments: ['id'],
  session_players: ['session_id', 'player_id'],
  sessions: ['id'],
  drink_ingredients: ['drink_id', 'item_id'],
  drinks: ['id'],
  players: ['id'],
  inventory_items: ['id'],
};

const LINK_TABLES: ReadonlySet<ClearedTable> = new Set(['player_share_links', 'player_claim_links']);

// The timestamptz columns of these tables. PostgREST renders one as
// 2026-09-25T12:34:56.789+00:00, with up to six fractional digits; the import writes
// toISOString()'s ...56.789Z. The same instant in two notations is not a difference.
const INSTANT_COLUMNS: ReadonlySet<string> = new Set(['created_at', 'played_on', 'expires_at', 'revoked_at', 'claimed_at']);

const INSTANT = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;

/** Whole seconds since the epoch, then the fraction to the microsecond Postgres keeps. */
function instant(text: string): string {
  const match = INSTANT.exec(text);
  if (!match) return `text:${text}`;
  const [, seconds = '', fraction = '', zone = ''] = match;
  return `${Date.parse(`${seconds}${zone}`) / 1000}.${fraction.padEnd(6, '0')}`;
}

// Keys sorted, because jsonb stores an object's keys in its own order and
// orders.ingredients is jsonb.
function stable(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(key, value[key])}`).join(',')}}`;
}

// A column only one side has is a difference ('absent' matches nothing else): a column
// the database has and the import does not model would otherwise be reset unseen.
function canonical(column: string, value: Json | undefined): string {
  if (value === undefined) return 'absent';
  if (typeof value === 'string' && INSTANT_COLUMNS.has(column)) return instant(value);
  return stable(value);
}

function keyOf(table: ClearedTable, row: Row): string {
  return KEYS[table].map((column) => canonical(column, row[column])).join('/');
}

function labelOf(table: ClearedTable, row: Row): string {
  if (LINK_TABLES.has(table)) return `player ${String(row.player_id ?? '?')}`;
  return KEYS[table].map((column) => String(row[column] ?? '?')).join('/');
}

interface Changed {
  label: string;
  columns: string[];
}

export interface TableDrift {
  table: ClearedTable;
  /** Live rows this run does not write: the clear would delete them. */
  extra: string[];
  /** Rows this run writes that are not live: the load would insert them. */
  missing: string[];
  /** The same row with different columns: the reload would overwrite them. */
  changed: Changed[];
}

export interface Drift {
  liveRows: number;
  bar: string[];
  tables: TableDrift[];
}

function changedColumns(expected: Row, live: Row): string[] {
  const columns = new Set([...Object.keys(expected), ...Object.keys(live)]);
  return [...columns].filter((column) => canonical(column, expected[column]) !== canonical(column, live[column])).sort();
}

function changedRows(table: ClearedTable, expected: Row[], live: Row[]): Changed[] {
  const want = new Map(expected.map((row) => [keyOf(table, row), row]));
  return live.flatMap((row) => {
    const match = want.get(keyOf(table, row));
    const columns = match ? changedColumns(match, row) : [];
    return columns.length > 0 ? [{ label: labelOf(table, row), columns }] : [];
  });
}

/** Labels of the rows in `rows` whose key is not in `other`. */
function absentFrom(table: ClearedTable, rows: Row[], other: Row[]): string[] {
  const keys = new Set(other.map((row) => keyOf(table, row)));
  return rows.filter((row) => !keys.has(keyOf(table, row))).map((row) => labelOf(table, row));
}

function diffTable(table: ClearedTable, expected: Row[], live: Row[]): TableDrift {
  return {
    table,
    extra: absentFrom(table, live, expected),
    missing: absentFrom(table, expected, live),
    changed: changedRows(table, expected, live),
  };
}

// The only bar columns a re-run writes (bar.ts updateBar).
function barDrift(bar: Row | undefined, target: BarTarget): string[] {
  if (!bar) throw new Error('drift: the bar row was not read');
  const wanted: Row = { name: target.name, venmo_handle: target.venmoHandle };
  return Object.keys(wanted).filter((column) => canonical(column, bar[column]) !== canonical(column, wanted[column]));
}

// The import writes no links, and verify deletes the ones it mints before it exits.
function expectedRows(rows: ImportRows): Record<ClearedTable, Row[]> {
  return { ...rows, player_share_links: [], player_claim_links: [] };
}

// A table left out of the read would look empty and pass the guard; stop instead.
function tableRows(live: Map<string, Row[]>, table: string): Row[] {
  const rows = live.get(table);
  if (!rows) throw new Error(`drift: ${table} was not read`);
  return rows;
}

// With the twelve tables empty there is nothing in them to lose, and listing every row
// the load is about to insert as "absent" would bury the one line that matters.
export async function findDrift(sb: Db, barId: string, rows: ImportRows, target: BarTarget): Promise<Drift> {
  const live = new Map((await takeSnapshot(sb, barId)).map((dump) => [dump.table, dump.rows]));
  const expected = expectedRows(rows);
  const liveRows = CLEAR_ORDER.reduce((sum, table) => sum + tableRows(live, table).length, 0);
  const tables = CLEAR_ORDER.map((table) => diffTable(table, expected[table], tableRows(live, table)));
  return {
    liveRows,
    bar: barDrift(tableRows(live, 'bars')[0], target),
    tables: liveRows === 0 ? [] : tables.filter((t) => t.extra.length + t.missing.length + t.changed.length > 0),
  };
}

export type Verdict = 'empty' | 'identical' | 'drifted';

/** (a) the bar holds nothing, (b) it holds exactly what this run writes, or neither. */
export function verdictOf(drift: Drift): Verdict {
  if (drift.bar.length > 0) return 'drifted';
  if (drift.liveRows === 0) return 'empty';
  return drift.tables.length === 0 ? 'identical' : 'drifted';
}

const SHOWN = 10;

function sample(labels: string[]): string {
  const shown = labels.slice(0, SHOWN).join(', ');
  return labels.length > SHOWN ? `${shown}, and ${labels.length - SHOWN} more` : shown;
}

// Worded for either cause, because the guard cannot tell the app's edits from Mongo's.
function printTable(t: TableDrift): void {
  if (t.extra.length > 0) console.log(`  ${t.table}: ${t.extra.length} in the bar that this import does not write — the clear would delete them: ${sample(t.extra)}`);
  if (t.missing.length > 0) console.log(`  ${t.table}: ${t.missing.length} this import writes that are not in the bar — the load would insert them: ${sample(t.missing)}`);
  if (t.changed.length > 0) console.log(`  ${t.table}: ${t.changed.length} differ from what this import writes — the reload would overwrite them: ${sample(t.changed.map((c) => `${c.label} (${c.columns.join(', ')})`))}`);
}

// Nothing extra, nothing changed, only rows missing: what an interrupted run leaves, and
// equally what deleting imported rows through the app, or adding documents to Mongo, leaves.
function onlyMissing(drift: Drift): boolean {
  return drift.bar.length === 0 && drift.tables.every((t) => t.extra.length === 0 && t.changed.length === 0);
}

function printDrift(drift: Drift): void {
  console.log('  guard: DIFFERS — the bar is neither empty nor exactly what this import writes');
  if (drift.bar.length > 0) console.log(`  bars: ${drift.bar.join(', ')} differ from what this run would set (--bar-name, NEXT_PUBLIC_VENMO_HANDLE)`);
  if (drift.liveRows === 0) console.log('  guard: the twelve tables are empty, so only the bar row above is at stake');
  drift.tables.forEach(printTable);
  if (onlyMissing(drift)) console.log('  guard: rows are only missing — an interrupted earlier run leaves exactly this, as does deleting imported rows through the app or adding documents to Mongo since; nothing here tells them apart');
}

const PASSED: Record<Exclude<Verdict, 'drifted'>, { plan: Plan; says: string }> = {
  empty: { plan: 'load', says: 'the bar holds no rows in any of the twelve tables, so the load only inserts and deletes nothing' },
  identical: { plan: 'keep', says: 'the bar is exactly what this import writes, so nothing is cleared or loaded' },
};

/**
 * Runs before any write, and picks how the run writes: (a) an empty bar is loaded,
 * (b) one identical to this run's rows is kept as it is, and anything else is refused
 * (null) unless `force`, which replaces it — the only plan that deletes. `force` on an
 * empty or identical bar changes nothing: there is nothing there to discard.
 */
export async function guardBar(sb: Db, barId: string, rows: ImportRows, target: BarTarget, force: boolean): Promise<Plan | null> {
  const drift = await findDrift(sb, barId, rows, target);
  const verdict = verdictOf(drift);
  if (verdict !== 'drifted') {
    console.log(`  guard: ${PASSED[verdict].says}${force ? ' (--force was not needed)' : ''}`);
    return PASSED[verdict].plan;
  }
  printDrift(drift);
  console.log(force
    ? 'import: --force — going on; every difference listed above is about to be deleted, re-inserted or reverted'
    : 'import: REFUSED before any write; nothing was changed. Re-run with --force only if discarding every difference above is intended.');
  return force ? 'replace' : null;
}

import type { ObjectId } from 'mongodb';

import { computeBalanceCents, toCents, type Json } from '@pb/core';

import { uuidFor } from './ids';
import type { MongoSource } from './source';
import { check, type Db } from './supabase';
import type { VerifyContext } from './verify';

// D9: verification is a per-player balance match to the cent, tolerance 0 — not a row
// count. Mongo's side is computed from Mongo's own documents; Postgres's side is read
// the way a real receipt page reads it, anonymously through get_shared_tab. Output is
// counts and pass/fail only: these are real people's balances.

/**
 * The balance every pre-migration screen showed: web/lib/bar-api.ts:127-140, operation
 * for operation, float sums in the same order, over every Mongo row for the player.
 * One toCents at the end is what "matches to the cent" means against that number.
 */
function mongoBalanceCents(player: ObjectId, s: MongoSource): number {
  const hex = player.toHexString();
  const mine = <T extends { playerId: ObjectId }>(rows: T[]): T[] => rows.filter((r) => r.playerId.toHexString() === hex);
  const drinks = mine(s.orders).reduce((sum, o) => sum + o.price, 0);
  const buys = mine(s.buyIns).reduce((sum, b) => sum + b.amount, 0);
  const outs = mine(s.cashouts).reduce((sum, c) => sum + c.amount, 0);
  const received = mine(s.payments).filter((p) => p.direction === 'received').reduce((sum, p) => sum + p.amount, 0);
  const sent = mine(s.payments).filter((p) => p.direction === 'sent').reduce((sum, p) => sum + p.amount, 0);
  return toCents(drinks + buys - outs - received + sent) + 0;
}

function mongoRowCounts(player: ObjectId, s: MongoSource): number[] {
  const hex = player.toHexString();
  const count = (rows: { playerId: ObjectId }[]): number => rows.filter((r) => r.playerId.toHexString() === hex).length;
  return [count(s.orders), count(s.buyIns), count(s.cashouts), count(s.payments)];
}

interface TabPayment {
  amountCents: number;
  direction: 'received' | 'sent';
}

interface Tab {
  orders: number[];
  buyIns: number[];
  cashouts: number[];
  payments: TabPayment[];
}

type JsonObject = { [key: string]: Json | undefined };

function asObject(value: Json | undefined, what: string): JsonObject {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value;
  throw new Error(`get_shared_tab: ${what} is not an object`);
}

function asArray(value: Json | undefined, what: string): Json[] {
  if (Array.isArray(value)) return value;
  throw new Error(`get_shared_tab: ${what} is not a list`);
}

function asCents(value: Json | undefined, what: string): number {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  throw new Error(`get_shared_tab: ${what} is not integer cents`);
}

function centsList(value: Json | undefined, field: string, what: string): number[] {
  return asArray(value, what).map((item) => asCents(asObject(item, what)[field], `${what}.${field}`));
}

function parsePayment(item: Json): TabPayment {
  const row = asObject(item, 'payments');
  const direction = row.direction;
  if (direction !== 'received' && direction !== 'sent') throw new Error('get_shared_tab: payment direction is invalid');
  return { amountCents: asCents(row.amount_cents, 'payments.amount_cents'), direction };
}

function parseTab(json: Json): Tab {
  const tab = asObject(json, 'result');
  return {
    orders: centsList(tab.orders, 'price_cents', 'orders'),
    buyIns: centsList(tab.buy_ins, 'amount_cents', 'buy_ins'),
    cashouts: centsList(tab.cashouts, 'amount_cents', 'cashouts'),
    payments: asArray(tab.payments, 'payments').map(parsePayment),
  };
}

/** Postgres's side, through the ported @pb/core function the new screens will use. */
function tabBalanceCents(playerId: string, tab: Tab): number {
  return (
    computeBalanceCents(
      playerId,
      tab.orders.map((priceCents) => ({ playerId, priceCents })),
      tab.buyIns.map((amountCents) => ({ playerId, amountCents })),
      tab.cashouts.map((amountCents) => ({ playerId, amountCents })),
      tab.payments.map((p) => ({ playerId, ...p })),
    ) + 0
  );
}

// Portal scope (session_id null) is the one that returns a player's whole history,
// which a lifetime balance needs. The links expire in 15 minutes and are deleted in
// `finally`, so a rehearsal never leaves a working token to a real ledger behind.
async function mintPortalLinks(sb: Db, barId: string, playerIds: string[]): Promise<Map<string, string>> {
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { data, error } = await sb
    .from('player_share_links')
    .insert(playerIds.map((id) => ({ bar_id: barId, player_id: id, session_id: null, expires_at: expiresAt })))
    .select('token, player_id');
  check(error, 'minting verification links');
  return new Map((data ?? []).map((row) => [row.player_id, row.token]));
}

async function deleteLinks(sb: Db, tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const { error } = await sb.from('player_share_links').delete().in('token', tokens);
  check(error, 'deleting verification links');
}

async function readTab(anon: Db, token: string | undefined): Promise<Tab> {
  if (!token) throw new Error('no verification link was minted for a player');
  const { data, error } = await anon.rpc('get_shared_tab', { p_token: token });
  check(error, 'get_shared_tab');
  if (data === null) throw new Error('get_shared_tab returned nothing');
  return parseTab(data);
}

interface PlayerResult {
  mongoId: string;
  balance: boolean;
  counts: boolean;
}

async function checkPlayer(ctx: VerifyContext, links: Map<string, string>, player: ObjectId): Promise<PlayerResult> {
  const id = uuidFor('players', player);
  const tab = await readTab(ctx.anon, links.get(id));
  const tabCounts = [tab.orders.length, tab.buyIns.length, tab.cashouts.length, tab.payments.length];
  return {
    mongoId: player.toHexString(),
    balance: tabBalanceCents(id, tab) === mongoBalanceCents(player, ctx.source),
    counts: tabCounts.join() === mongoRowCounts(player, ctx.source).join(),
  };
}

function report(results: PlayerResult[]): boolean {
  const balances = results.filter((r) => r.balance).length;
  const counts = results.filter((r) => r.counts).length;
  console.log(`  balances: ${balances}/${results.length} players matched to the cent (tolerance 0)`);
  console.log(`  per-player row counts (orders, buy-ins, cash-outs, payments): ${counts}/${results.length} matched`);
  for (const r of results.filter((x) => !x.balance || !x.counts)) {
    console.log(`  MISMATCH mongo player ${r.mongoId}: balance ${r.balance ? 'ok' : 'differs'}, counts ${r.counts ? 'ok' : 'differ'}`);
  }
  return balances === results.length && counts === results.length;
}

export async function verifyBalances(ctx: VerifyContext): Promise<boolean> {
  const players = ctx.source.players.map((p) => p.id);
  const links = await mintPortalLinks(ctx.sb, ctx.barId, players.map((p) => uuidFor('players', p)));
  try {
    const results: PlayerResult[] = [];
    for (const player of players) results.push(await checkPlayer(ctx, links, player));
    return report(results);
  } finally {
    await deleteLinks(ctx.sb, [...links.values()]);
  }
}

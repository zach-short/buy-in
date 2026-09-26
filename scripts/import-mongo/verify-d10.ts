import { check } from './supabase';
import type { VerifyContext } from './verify';

// D10 on real data, proved two ways. Positively: every real player and every real
// cash-out was inserted under both unique indexes (a violation would have failed the
// load). Negatively: a copy of one real row is offered and must be refused with
// 23505 by the named index — which proves the index is live, not merely declared. A
// probe that is somehow accepted is deleted at once and the check fails.

type ProbeResult = PromiseLike<{ data: { id: string }[] | null; error: { message: string; code?: string } | null }>;

async function expectRejected(ctx: VerifyContext, table: 'players' | 'cashouts', index: string, attempt: () => ProbeResult): Promise<boolean> {
  const { data, error } = await attempt();
  if (data && data.length > 0) {
    const { error: cleanup } = await ctx.sb.from(table).delete().in('id', data.map((row) => row.id));
    check(cleanup, `removing an accepted ${table} probe`);
    console.log(`  ${index}: FAILED — a duplicate was accepted (probe removed)`);
    return false;
  }
  const rejected = error?.code === '23505' && error.message.includes(index);
  console.log(`  ${index}: duplicate of a real row ${rejected ? 'rejected with 23505' : `not rejected as expected (${error?.code ?? 'no error'})`}`);
  return rejected;
}

async function probePlayerName(ctx: VerifyContext): Promise<boolean> {
  const real = ctx.rows.players[0];
  console.log(`  real players inserted under players_bar_name_uniq: ${ctx.rows.players.length}`);
  if (!real) return false;
  return expectRejected(ctx, 'players', 'players_bar_name_uniq', () =>
    ctx.sb.from('players').insert({ bar_id: ctx.barId, name: real.name }).select('id'),
  );
}

async function probeCashout(ctx: VerifyContext): Promise<boolean> {
  const real = ctx.rows.cashouts[0];
  console.log(`  real cash-outs inserted under cashouts_session_player_uniq: ${ctx.rows.cashouts.length}`);
  if (!real) return false;
  return expectRejected(ctx, 'cashouts', 'cashouts_session_player_uniq', () =>
    ctx.sb
      .from('cashouts')
      .insert({ bar_id: ctx.barId, session_id: real.session_id, player_id: real.player_id, amount_cents: 1 })
      .select('id'),
  );
}

export async function verifyD10(ctx: VerifyContext): Promise<boolean> {
  const names = await probePlayerName(ctx);
  const cashouts = await probeCashout(ctx);
  return names && cashouts;
}

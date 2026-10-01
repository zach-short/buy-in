/** One seated player on the new-session screen: the buy-in typed, in integer cents; `null` is a blank field. */
export interface BuyInDraft {
  playerId: string;
  cents: number | null;
}

/** One row of start_session's `p_players` (0002). */
export interface StartBuyIn {
  playerId: string;
  buyInCents: number;
}

export type StartBuyIns = { kind: 'ready'; buyIns: StartBuyIn[] } | { kind: 'blank'; playerIds: string[] };

/**
 * The buy-ins a night starts with, or the players whose buy-in is blank. A blank blocks the
 * start (owner, 2026-09-30): it is a field the host skipped, and reading it as $0 seated a player
 * with nothing bought in and no sign of it. A typed 0 is a decision, and passes through as 0:
 * start_session (0002) seats that player and writes no buy-in row for them.
 */
export function startBuyIns(drafts: readonly BuyInDraft[]): StartBuyIns {
  const buyIns: StartBuyIn[] = [];
  const blank: string[] = [];
  for (const { playerId, cents } of drafts) {
    if (cents === null) blank.push(playerId);
    else buyIns.push({ playerId, buyInCents: cents });
  }
  return blank.length ? { kind: 'blank', playerIds: blank } : { kind: 'ready', buyIns };
}

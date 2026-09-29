import { describeNet, formatCents, type NetKind } from '@pb/core';

// The words every per-night surface puts on a net, so the receipt, the host's receipt and
// settle-up cannot drift apart again. No line carries a minus sign on the total: winners
// used to read "Total owed $-12.00". `player` is a receipt addressed to the player; `host`
// is the host's own list, where "You're owed" would be the wrong way round.

export type NetAudience = 'player' | 'host';

const NET_LABEL: Readonly<Record<NetAudience, Readonly<Record<NetKind, string>>>> = {
  player: { owes: 'Owes', owed: "You're owed", even: 'Settled' },
  host: { owes: 'Owes', owed: 'Owed', even: 'Settled' },
};

export interface NetParts {
  kind: NetKind;
  label: string;
  /** `$12.00`, or null when settled — there is no amount to show. */
  amount: string | null;
}

export function netParts(netCents: number, audience: NetAudience): NetParts {
  const { kind, amountCents } = describeNet(netCents);
  return { kind, label: NET_LABEL[audience][kind], amount: kind === 'even' ? null : `$${formatCents(amountCents)}` };
}

/** "Owes $12.00" / "You're owed $12.00" / "Settled". */
export function netText(netCents: number, audience: NetAudience): string {
  const { label, amount } = netParts(netCents, audience);
  return amount ? `${label} ${amount}` : label;
}

/**
 * The payments line, signed like the rest of a receipt (buy-ins +, cash-outs −). Received
 * money pays the tab down; money the host sent the player adds back to it.
 */
export function paidLine(paidCents: number, audience: NetAudience): { label: string; amount: string } {
  if (paidCents < 0) {
    return { label: audience === 'player' ? 'Paid to you' : 'Paid out', amount: `+$${formatCents(-paidCents)}` };
  }
  return { label: 'Paid', amount: `−$${formatCents(paidCents)}` };
}

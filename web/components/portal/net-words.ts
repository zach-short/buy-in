import { describeNet, formatCents, type NetKind } from '@pb/core';

// The portal speaks to the player, in the second person, about their whole tab — so its
// words differ from net-copy.ts's receipt labels ("Owes", "Settled"). Same rule: never a
// minus sign, the direction is in the words.

const PORTAL_NET_LABEL: Readonly<Record<NetKind, string>> = {
  owes: 'You owe',
  owed: "You're owed",
  even: 'All square',
};

/** "You owe $12.00" / "You're owed $12.00" / "All square". */
export function portalNetText(netCents: number): string {
  const { kind, amountCents } = describeNet(netCents);
  return kind === 'even' ? PORTAL_NET_LABEL.even : `${PORTAL_NET_LABEL[kind]} $${formatCents(amountCents)}`;
}

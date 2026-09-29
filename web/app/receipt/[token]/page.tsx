import { pageMetadata } from '@/lib/page-metadata';

import ReceiptUI from './receipt-ui';

// Static on purpose (owner, 2026-09-27, extending GATE 2's G4). The title used to carry the
// player's name and the night's date, read server-side; link-preview bots cache it, so a
// revoked link would still preview who it belonged to. Same accepted cost as deleting the
// OG image: a texted receipt shows a plain card. The card is generic by design and now carries
// a description, Open Graph and Twitter text too — none of it may name a player, table or amount.
export const metadata = pageMetadata({
  title: 'Receipt',
  description: 'A receipt from poker night — tap to see the drinks, buy-in and total, and settle up.',
  private: true,
});

export default function PublicReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  return <ReceiptUI params={params} />;
}

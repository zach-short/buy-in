import type { Metadata } from 'next';

import ReceiptUI from './receipt-ui';

// Static on purpose (owner, 2026-09-27, extending GATE 2's G4). The title used to carry the
// player's name and the night's date, read server-side; link-preview bots cache it, so a
// revoked link would still preview who it belonged to. Same accepted cost as deleting the
// OG image: a texted receipt shows a plain title.
export const metadata: Metadata = { title: 'Receipt' };

export default function PublicReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  return <ReceiptUI params={params} />;
}

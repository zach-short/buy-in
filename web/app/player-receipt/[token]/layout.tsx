import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

// Static and generic on purpose — see the comment atop app/receipt/[token]/page.tsx (G4).
export const metadata = pageMetadata({
  title: 'Your receipt',
  description: 'Your receipt for the night — drinks, buy-in and what you owe. Tap to view or settle up.',
  private: true,
});

export default function PlayerReceiptLayout({ children }: { children: ReactNode }) {
  return children;
}

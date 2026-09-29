import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

// Static and generic on purpose — see the comment atop app/receipt/[token]/page.tsx (G4).
export const metadata = pageMetadata({
  title: 'Your tab',
  description: 'Your running tab and past nights at the table — tap to see your balance and settle up.',
  private: true,
});

export default function PortalLayout({ children }: { children: ReactNode }) {
  return children;
}

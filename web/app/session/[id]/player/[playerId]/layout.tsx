import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Player receipt',
  description: 'One player’s buy-ins, drinks and cash-out for this session.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

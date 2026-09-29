import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'New session',
  description: 'Start a poker session with a buy-in amount and the players at the table.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

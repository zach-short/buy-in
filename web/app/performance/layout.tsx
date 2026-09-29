import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Player performance',
  description: 'Net results and buy-in history for each player over time.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

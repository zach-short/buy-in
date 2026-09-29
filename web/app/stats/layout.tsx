import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Stats',
  description: 'Totals and trends across all your poker sessions.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

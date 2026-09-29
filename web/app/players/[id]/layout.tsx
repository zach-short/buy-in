import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Player',
  description: 'Player details, balance and payment history.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

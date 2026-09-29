import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Sessions',
  description: 'Every poker session you have run, active and finished.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

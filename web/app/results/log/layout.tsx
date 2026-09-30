import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Log an event',
  description: 'Record a poker session or another event on your results.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

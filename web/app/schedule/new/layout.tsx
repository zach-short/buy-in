import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Schedule a game',
  description: 'Pick a date and time for a new game night and invite your players.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Settings',
  description: 'Your Venmo note and default buy-in.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

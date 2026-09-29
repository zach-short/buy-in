import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Settings',
  description: 'Your Venmo note, default buy-in and what is new in the app.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

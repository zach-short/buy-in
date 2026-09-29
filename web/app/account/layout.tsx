import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Account',
  description: 'Your account, settings and the rest of your bar tools.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Invites',
  description: 'Invite links for bringing players and co-hosts into your games.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Welcome',
  description: 'Set up your Buy-In account: host a poker night or join a table.',
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

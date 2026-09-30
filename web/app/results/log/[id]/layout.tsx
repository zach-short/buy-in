import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Edit session',
  description: 'Change or remove a poker session you logged.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

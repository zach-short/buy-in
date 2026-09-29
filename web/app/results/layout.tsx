import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Results',
  description: 'Your poker results across every table, and your bar’s profit night by night.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

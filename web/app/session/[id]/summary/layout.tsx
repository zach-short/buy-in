import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Session summary',
  description: 'Final results and settlements for a finished session.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Session',
  description: 'Live table: buy-ins, rebuys and cash-outs for this session.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

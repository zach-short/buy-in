import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Players',
  description: 'Your player roster with contact and payment details.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

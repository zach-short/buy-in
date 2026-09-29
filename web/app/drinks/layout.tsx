import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Drinks',
  description: 'The bar menu of drinks and their prices.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

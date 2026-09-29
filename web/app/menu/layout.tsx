import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({ title: 'Menu', description: "Tonight's drink menu" });

export default function MenuLayout({ children }: { children: ReactNode }) {
  return children;
}

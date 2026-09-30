import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Edit event',
  description: 'Change the details of an event on your results.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

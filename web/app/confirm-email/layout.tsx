import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Check your email',
  description: 'Open the link we emailed you to finish creating your Buy-In account.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

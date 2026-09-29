import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: "What's new",
  description: 'The changelog for Buy-In: new features and fixes, newest first.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

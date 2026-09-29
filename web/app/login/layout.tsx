import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: "Log in",
  description:
    "Log in to Buy-In to run your bar tab and game nights.",
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

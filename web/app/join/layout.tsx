import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: "Join a table",
  description:
    "Enter your invite code to join a poker table on Buy-In.",
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

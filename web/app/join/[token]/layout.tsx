import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: "You're invited",
  description:
    "You've been invited to join a poker table on Buy-In. Tap to pick your name and get a seat.",
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

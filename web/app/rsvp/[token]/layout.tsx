import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: "RSVP",
  description:
    "Let the host know if you're in for game night. One tap: I'm in, Can't make it, or Maybe.",
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

// Static titles only: these pages are client components, so a server layout is the only place metadata can live.
export const metadata = pageMetadata({
  title: 'Game nights',
  description: 'Upcoming scheduled poker games and who has RSVPed.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

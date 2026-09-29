'use client';

import dynamic from 'next/dynamic';

import type { HomeSessions } from '@/lib/supabase/home-queries';
import { useRefreshOnAuthChange } from '@/components/home/use-refresh-on-auth-change';

// next/dynamic from a Client Component, not the server page: a Server Component's dynamic
// import is not code-split (node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md,
// Next 16.2.4). Each Home is its own chunk, so a member never downloads the dashboard, a host
// never downloads the member's tables, and a signed-out visitor downloads neither. Both are
// still server-rendered.
const Dashboard = dynamic(() => import('@/components/home/dashboard').then((m) => m.Dashboard));
const MemberHome = dynamic(() => import('@/components/member/member-home').then((m) => m.MemberHome));

interface HomeSignedInProps {
  isStaff: boolean;
  /** Staff only; `null` for a member, or when the server read failed. */
  sessions: HomeSessions | null;
}

// A joined player lands here after /join (use-join-flow.ts), so an account that hosts nowhere
// gets its tables, never the host's Start New Session (member-home SCOPE.md §5 H1, H8). The
// staff answer arrives with the page now, so neither Home can flash at the wrong account.
export function HomeSignedIn({ isStaff, sessions }: HomeSignedInProps) {
  useRefreshOnAuthChange(true);
  return isStaff ? <Dashboard initialSessions={sessions} /> : <MemberHome />;
}

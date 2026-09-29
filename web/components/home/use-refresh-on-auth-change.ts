'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthUser } from '@/hooks/use-auth-user';

/**
 * Home is rendered on the server for whoever the cookie said. When the client session later
 * disagrees — signed out or in from another tab, or a refresh token that failed — re-render
 * the server page, as the old client-only page flipped between Landing and Home in place.
 * The effect only re-runs when the answer changes, so a lasting disagreement refreshes once.
 */
export function useRefreshOnAuthChange(renderedSignedIn: boolean): void {
  const router = useRouter();
  const { status } = useAuthUser();

  useEffect(() => {
    if (status === 'loading') return;
    if ((status === 'authenticated') !== renderedSignedIn) router.refresh();
  }, [status, renderedSignedIn, router]);
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import { MenuBoard } from '@/components/shared/menu-board';
import { StatusScreen } from '@/components/shared/status-screen';
import { useAuthUser } from '@/hooks/use-auth-user';
import { fetchBarId } from '@/lib/supabase/queries';

// The account page links here. A signed-in host is sent to their own bar's menu; anyone
// else has no bar to show and sees the empty board — guests reach a menu through the
// /menu/<bar id> link a host shares (owner, 2026-09-27).
export default function MenuPage() {
  const router = useRouter();
  const { status } = useAuthUser();
  // Through SWR, not a bare promise: a failed bar read used to leave this page blank forever.
  const { data: barId, error, mutate } = useSWR(status === 'authenticated' ? 'bar_id' : null, fetchBarId);

  useEffect(() => {
    if (barId) router.replace(`/menu/${barId}`);
  }, [barId, router]);

  if (error) {
    return <StatusScreen kind='error' message={(error as Error).message} action={{ label: 'Try again', onClick: () => void mutate() }} />;
  }
  return status === 'unauthenticated' ? <MenuBoard items={[]} /> : null;
}

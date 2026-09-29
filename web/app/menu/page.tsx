'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { MenuBoard } from '@/components/shared/menu-board';
import { useAuthUser } from '@/hooks/use-auth-user';
import { fetchBarId } from '@/lib/supabase/queries';

// The account page links here. A signed-in host is sent to their own bar's menu; anyone
// else has no bar to show and sees the empty board — guests reach a menu through the
// /menu/<bar id> link a host shares (owner, 2026-09-27).
export default function MenuPage() {
  const router = useRouter();
  const { status } = useAuthUser();

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchBarId().then((barId) => router.replace(`/menu/${barId}`));
  }, [status, router]);

  return status === 'unauthenticated' ? <MenuBoard items={[]} /> : null;
}

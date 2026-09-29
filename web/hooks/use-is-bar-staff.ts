'use client';

import useSWR from 'swr';

import { createClient } from '@/lib/supabase/client';
import { useAuthUser } from '@/hooks/use-auth-user';

// Mirrors is_bar_staff() (0001_init.sql): owner or host of any bar, never a 'player' member.
// bar_members_member lets a member read every member row of their bars, so the filter on the
// caller's own user_id is what makes this answer about them.
async function fetchIsBarStaff(userId: string): Promise<boolean> {
  const { data, error } = await createClient().from('bar_members')
    .select('bar_id').eq('user_id', userId).in('role', ['owner', 'host']).limit(1);
  if (error) throw error;
  return data.length > 0;
}

/**
 * `undefined` while unknown. A failed check reads as staff: RLS already keeps a player out of
 * the bar's rows, so the cost is an empty tab, where the other way a host loses theirs.
 */
export function useIsBarStaff(): boolean | undefined {
  const { user } = useAuthUser();
  const { data, error } = useSWR(user ? ['is_bar_staff', user.id] : null, ([, id]) => fetchIsBarStaff(id));
  if (error) return true;
  return data;
}

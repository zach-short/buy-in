'use client';

import useSWR from 'swr';

import { createClient } from '@/lib/supabase/client';
import { useAuthUser } from '@/hooks/use-auth-user';

// Keyed by account, so a shared device never draws one person's nav from another's answer.
function lastAnswerKey(userId: string): string {
  return `buy-in:is-bar-staff:${userId}`;
}

/**
 * The last staff answer this device saw for this account, or `undefined` when it has none. For
 * choosing which nav to draw while the live read is in flight (app-shell.tsx), never for
 * deciding whether a host page renders: roles change, and only the live read knows.
 */
export function readLastStaffAnswer(userId: string): boolean | undefined {
  try {
    const stored = window.localStorage.getItem(lastAnswerKey(userId));
    return stored === 'true' ? true : stored === 'false' ? false : undefined;
  } catch {
    // Private mode, blocked storage or no window: act as a device that has never seen one.
    return undefined;
  }
}

function rememberStaffAnswer(userId: string, isStaff: boolean): void {
  try {
    window.localStorage.setItem(lastAnswerKey(userId), String(isStaff));
  } catch {
    // Not remembered: the next launch waits for the live read, as it did before.
  }
}

// Mirrors is_bar_staff() (0001_init.sql): owner or host of any bar, never a 'player' member.
// bar_members_member lets a member read every member row of their bars, so the filter on the
// caller's own user_id is what makes this answer about them.
async function fetchIsBarStaff(userId: string): Promise<boolean> {
  const { data, error } = await createClient().from('bar_members')
    .select('bar_id').eq('user_id', userId).in('role', ['owner', 'host']).limit(1);
  if (error) throw error;
  const isStaff = data.length > 0;
  // Only an answer the database gave is kept. The error fallback in useIsBarStaff never is, or
  // one failed read would draw the host's nav for a member on every later launch.
  rememberStaffAnswer(userId, isStaff);
  return isStaff;
}

/**
 * `undefined` while unknown. A failed check reads as staff: RLS already keeps a player out of
 * the bar's rows, so the cost is an empty tab, where the other way a host loses theirs. This is
 * the live answer only; `readLastStaffAnswer` is the remembered one.
 */
export function useIsBarStaff(): boolean | undefined {
  const { user } = useAuthUser();
  const { data, error } = useSWR(user ? ['is_bar_staff', user.id] : null, ([, id]) => fetchIsBarStaff(id));
  if (error) return true;
  return data;
}

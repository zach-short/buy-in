import { writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

/** Which of the setup guide's data-backed items the bar has done (host-setup PLAN phase 3). */
export interface SetupProgress {
  players: boolean;
  invite: boolean;
  session: boolean;
}

type ProgressTable = 'players' | 'bar_invite_links' | 'sessions';

// All three tables are read under is_bar_staff (0001:404,410; 0004:107), not bars.owner_id,
// so a host who is not the owner sees the same answer (PLAN phase 3 "watch for"). bar_id is
// the one column all three share (bar_invite_links has no id).
async function hasAny(table: ProgressTable, barId: string): Promise<boolean> {
  const { count, error } = await createClient().from(table)
    .select('bar_id', { count: 'exact', head: true }).eq('bar_id', barId);
  if (error) throw new Error(writeErrorMessage(error));
  return (count ?? 0) > 0;
}

export async function fetchSetupProgress(barId: string): Promise<SetupProgress> {
  const [players, invite, session] = await Promise.all([
    hasAny('players', barId),
    hasAny('bar_invite_links', barId),
    hasAny('sessions', barId),
  ]);
  return { players, invite, session };
}

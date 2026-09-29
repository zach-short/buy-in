import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Tables } from '@pb/core';

// Home's reads, sized to what Home shows. The dashboard used to page through every session
// with its players embedded (fetchSessions, queries.ts) only to keep two rows of it. Each
// function takes the typed client instead of creating one, so the server page (server.ts)
// and the dashboard's revalidation (client.ts) run the same query.

type Client = SupabaseClient<Database>;

export type HomeSession = Pick<Tables<'sessions'>, 'id' | 'name'>;

export interface HomeSessions {
  active: HomeSession | null;
  lastClosed: HomeSession | null;
}

// The same row the old `sessions.find(s => s.status === status)` picked: fetchSessions sorts
// `played_on` desc, then `id` asc (queries.ts), so the first match is the first row here.
async function latestSession(supabase: Client, status: 'active' | 'closed'): Promise<HomeSession | null> {
  const { data, error } = await supabase.from('sessions').select('id, name').eq('status', status)
    .order('played_on', { ascending: false }).order('id').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

/** The live session to resume and the last closed one, read in parallel. RLS scopes both to the caller's bars. */
export async function fetchHomeSessions(supabase: Client): Promise<HomeSessions> {
  const [active, lastClosed] = await Promise.all([latestSession(supabase, 'active'), latestSession(supabase, 'closed')]);
  return { active, lastClosed };
}

/**
 * Mirrors fetchIsBarStaff (use-is-bar-staff.ts) for the server: owner or host of any bar. A
 * failed check reads as staff there too — RLS keeps a player out of the bar's rows, so the
 * cost is an empty dashboard, where the other way a host loses theirs.
 */
export async function fetchIsBarStaff(supabase: Client, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('bar_members')
    .select('bar_id').eq('user_id', userId).in('role', ['owner', 'host']).limit(1);
  return error ? true : data.length > 0;
}

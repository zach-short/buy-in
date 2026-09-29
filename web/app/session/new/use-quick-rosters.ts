'use client';

import useSWR from 'swr';

import type { PlayerRow } from '@/lib/supabase/queries';
import { fetchLastRoster, fetchTonightRsvps } from '@/lib/supabase/session-setup';

export interface QuickRosters {
  /** Everyone seated at the most recent session who is still on the player list. */
  lastTime: PlayerRow[];
  /** Today's scheduled game and its yes answers that map to a player, or null when there is no game today. */
  tonight: { gameName: string; players: PlayerRow[] } | null;
}

// Both are shortcuts, never the only way to seat someone, so a failed read hides its button
// rather than blocking the screen.
export function useQuickRosters(players: PlayerRow[]): QuickRosters {
  const { data: lastIds = [] } = useSWR(['session_setup', 'last_roster'], fetchLastRoster);
  const { data: rsvps = null } = useSWR(['session_setup', 'tonight_rsvps'], fetchTonightRsvps);

  const byId = new Map(players.map((p) => [p.id, p]));
  const lastTime = lastIds.flatMap((id) => byId.get(id) ?? []);
  const yes = new Set(rsvps?.userIds);
  const tonight = rsvps && {
    gameName: rsvps.game.name,
    players: players.filter((p) => p.user_id !== null && yes.has(p.user_id)),
  };
  return { lastTime, tonight };
}

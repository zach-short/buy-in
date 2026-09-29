'use client';

import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { REALTIME_REFETCH_DEBOUNCE_MS, SESSION_FALLBACK_POLL_MS } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';
import { fetchSession } from '@/lib/supabase/queries';

// Phase 11 (PLAN.md; SCOPE-phase-11.md §7): the live session screen learns of other devices'
// writes over Postgres Changes and refetches the matching SWR key. Events are only a signal —
// nothing is read from a payload, so a DELETE for a row this client never loaded is harmless
// (SCOPE H-d) and the screen always renders what the query returns, never what an event said.
//
// The poll map (DESIGN.md H11 — which surfaces subscribe and which poll), as of 2026-09-29:
// - /session/[id] subscribes through this hook; its session-scoped keys poll every
//   SESSION_FALLBACK_POLL_MS only while the channel is not SUBSCRIBED.
// - /portal, /player-receipt and /receipt neither subscribe nor poll. They are anonymous, and
//   anon has no select policy, so Postgres Changes would deliver them nothing (0001_init.sql:862-864).
// - /players, /sessions, /stats and /inventory are unchanged: SWR, no subscription, no poll.

type SwrKey = string | [string, string];
type Mutate = ReturnType<typeof useSWRConfig>['mutate'];

interface Listener {
  table: 'orders' | 'buy_ins' | 'cashouts' | 'sessions' | 'session_players' | 'inventory_items';
  filter: string;
  keys: SwrKey[];
  /** Also listen, unfiltered, for DELETE — see sessionListeners. */
  deletes?: boolean;
}

// Keys match the page's useSWR calls (web/lib/supabase/queries.ts:10-14). A DELETE cannot be
// filtered at default replica identity (Supabase Postgres Changes docs, "Delete events"), and
// FULL is ruled out (0001_init.sql:865-867), so the tables whose deletes this screen shows —
// an undone pour, a deleted session — also get an unfiltered DELETE listener: any delete of
// that table anywhere refetches this screen's key. At one bar's volume that is a few reads.
function sessionListeners(sessionId: string, barId: string): Listener[] {
  const bySession = `session_id=eq.${sessionId}`;
  return [
    { table: 'orders', filter: bySession, keys: [['orders', sessionId]], deletes: true },
    { table: 'buy_ins', filter: bySession, keys: [['buy_ins', sessionId]] },
    { table: 'cashouts', filter: bySession, keys: [['cashouts', sessionId]] },
    { table: 'sessions', filter: `id=eq.${sessionId}`, keys: [['session', sessionId]], deletes: true },
    // The page names seated players from the whole-bar 'players' list, and a player added
    // mid-night may have been created on the other device; players is not published (Q1), so
    // a roster change refetches that list too.
    { table: 'session_players', filter: bySession, keys: [['session', sessionId], 'players'] },
    { table: 'inventory_items', filter: `bar_id=eq.${barId}`, keys: ['inventory'] },
  ];
}

function listen(channel: RealtimeChannel, listeners: Listener[], onChange: (keys: SwrKey[]) => void) {
  for (const { table, filter, keys, deletes } of listeners) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => onChange(keys));
    if (deletes) channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, () => onChange(keys));
  }
  return channel;
}

// Collects every key touched during one burst and refetches each once when the window closes.
function createRefetcher(mutate: Mutate) {
  const pending = new Map<string, SwrKey>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  function flush() {
    timer = undefined;
    for (const key of pending.values()) void mutate(key);
    pending.clear();
  }
  return {
    queue(keys: SwrKey[]) {
      for (const key of keys) pending.set(JSON.stringify(key), key);
      timer ??= setTimeout(flush, REALTIME_REFETCH_DEBOUNCE_MS);
    },
    cancel() {
      clearTimeout(timer);
      pending.clear();
    },
  };
}

// realtime-js hands back the existing channel for a topic it still holds, and removeChannel is
// async — so a remount (React strict mode, a quick back-and-forward) could be given the channel
// being torn down. A per-mount suffix keeps every mount on its own channel.
let mountSeq = 0;

// Opens one channel for one mounted screen and returns its teardown. `active` drops the
// status callbacks of a channel already being removed, so a late CLOSED from the old mount
// cannot overwrite the new mount's SUBSCRIBED.
function openSessionChannel(
  sessionId: string, barId: string, mutate: Mutate, onStatus: (subscribed: boolean) => void,
): () => void {
  const supabase = createClient();
  const listeners = sessionListeners(sessionId, barId);
  const refetcher = createRefetcher(mutate);
  let active = true;
  const channel = listen(supabase.channel(`session:${sessionId}:${++mountSeq}`), listeners, refetcher.queue)
    .subscribe((state, err) => {
      if (!active) return;
      onStatus(state === 'SUBSCRIBED');
      // Events that landed before the join, or while the socket was down, were never sent.
      if (state === 'SUBSCRIBED') refetcher.queue(listeners.flatMap((l) => l.keys));
      // supabase-js rejoins on its own (Realtime docs, "Channel States"); the page's fallback
      // poll covers the gap meanwhile, so nothing here retries.
      if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') console.error(`realtime ${state}`, err);
    });
  return () => {
    active = false;
    refetcher.cancel();
    void supabase.removeChannel(channel);
  };
}

export interface SessionRealtime {
  /** True only while the channel is `SUBSCRIBED`. */
  subscribed: boolean;
  /** For the page's session-scoped useSWR calls: 0 while subscribed, the fallback poll otherwise. */
  refreshInterval: number;
}

/**
 * Subscribes the live session screen to its tables while mounted, and says how often the
 * page should poll meanwhile (SCOPE-phase-11.md §7 Q3). The bar id for the inventory filter
 * comes from the session row, which this hook reads on the page's own ['session', id] key —
 * SWR shares the entry and dedupes the fetch — so it can also give that key the fallback poll.
 * Nothing subscribes until the row has loaded.
 */
export function useSessionRealtime(sessionId: string): SessionRealtime {
  const { mutate } = useSWRConfig();
  // Status is tagged with the session it belongs to, so navigating to another session reads as
  // not-subscribed until the new channel joins — without resetting state inside the effect.
  // (A session's bar_id never changes, so the session id alone is the scope.)
  const [status, setStatus] = useState<{ sessionId: string; subscribed: boolean }>();
  const subscribed = status?.sessionId === sessionId && status.subscribed;
  const refreshInterval = subscribed ? 0 : SESSION_FALLBACK_POLL_MS;
  const { data: session } = useSWR(['session', sessionId], ([, id]) => fetchSession(id), { refreshInterval });
  const barId = session?.bar_id;

  useEffect(() => {
    if (!barId) return;
    return openSessionChannel(sessionId, barId, mutate, (isSubscribed) => setStatus({ sessionId, subscribed: isSubscribed }));
  }, [sessionId, barId, mutate]);

  return { subscribed, refreshInterval };
}

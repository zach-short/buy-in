import { parseMenu, parseSharedTab, requireScope, type MenuItem, type SharedTab, type SharedTabScope } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

// Phase 7 (PLAN.md): the only reads an anonymous visitor can make. Each is a security-definer
// RPC from 0001 — get_shared_tab for a player's receipt or portal (D8, D15), get_menu for a
// bar's menu (D14, BD-3) — and nothing here touches a table, because under D8 no table has an
// `anon` policy. supabase-js calls an RPC by POST, so a token never lands in a query string
// or an access log (DESIGN.md §9.1 #8).
//
// get_shared_tab answers a missing, revoked or expired token with one error (0001's
// "invalid or expired link"); the pages render one error state for all three, and for a
// link of the wrong scope, so nothing on screen tells them apart.

/** The tab behind a share link, refused unless it is the scope this page renders. */
export async function fetchSharedTab(token: string, scope: SharedTabScope): Promise<SharedTab> {
  const { data, error } = await createClient().rpc('get_shared_tab', { p_token: token });
  if (error) throw error;
  return requireScope(parseSharedTab(data), scope);
}

/** A bar's menu with availability computed server-side — never its stock levels. */
export async function fetchMenu(barId: string): Promise<MenuItem[]> {
  const { data, error } = await createClient().rpc('get_menu', { p_bar_id: barId });
  if (error) throw error;
  return parseMenu(data);
}

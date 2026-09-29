import { createClient } from '@supabase/supabase-js';

import { parseMenu, type MenuItem } from '@pb/core';
import { clientEnv } from '@/lib/env/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No cookies and no session, so reading it does not force the route dynamic, and it is the
// same anonymous caller as the browser's get_menu read.
function anonClient() {
  return createClient(clientEnv.supabaseUrl, clientEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * The public menu for link-preview text, read on the server. It never throws and returns []
 * for a malformed id, an unknown bar or a failed read alike — get_menu already refuses to say
 * whether a bar exists (0001), and this must not add a way to tell.
 */
export async function fetchMenuForMetadata(barId: string): Promise<MenuItem[]> {
  if (!UUID.test(barId)) return [];
  try {
    const { data, error } = await anonClient().rpc('get_menu', { p_bar_id: barId });
    return error ? [] : parseMenu(data);
  } catch {
    return [];
  }
}

export interface InvitePreview {
  barName: string;
  gameName: string | null;
  scheduledAt: string | null;
  cancelled: boolean;
}

function parseInvitePreview(data: unknown): InvitePreview | null {
  if (typeof data !== 'object' || data === null) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.bar_name !== 'string') return null;
  return {
    barName: row.bar_name,
    gameName: typeof row.game_name === 'string' ? row.game_name : null,
    scheduledAt: typeof row.scheduled_at === 'string' ? row.scheduled_at : null,
    cancelled: row.cancelled === true,
  };
}

/**
 * The table and game night behind an invite token, for link-preview text (0005). Null for a
 * dead token and for any failure alike — including 0005 not being applied yet — so the layout
 * falls back to its generic card rather than erroring.
 */
export async function fetchInvitePreview(token: string): Promise<InvitePreview | null> {
  try {
    const { data, error } = await anonClient().rpc('get_invite_preview', { p_token: token });
    return error ? null : parseInvitePreview(data);
  } catch {
    return null;
  }
}

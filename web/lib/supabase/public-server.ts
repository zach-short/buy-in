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

import type { PostgrestError } from '@supabase/supabase-js';

import { VENMO_NOTE_TEMPLATE_MAX_LENGTH, writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

// Bar-level settings the host edits, starting with the Venmo note template (owner
// decision 2026-09-27, migration 0003). Kept out of writes.ts and queries.ts so this
// feature does not collide with the phase that owns those files; the error handling is
// theirs — writeErrorMessage for the message, and a zero-row update treated as refused.

function fail(error: PostgrestError): never {
  // 0003's length check. writeErrorMessage would pass Postgres's own words through;
  // say what the host can act on instead.
  if (error.code === '23514' && error.message.includes('bars_venmo_note_template_len')) {
    throw new Error(`Keep the note to ${VENMO_NOTE_TEMPLATE_MAX_LENGTH} characters or fewer`);
  }
  throw new Error(writeErrorMessage(error));
}

export interface BarSettings {
  barId: string;
  /** `null` means the default note (`Buy-In`). */
  venmoNoteTemplate: string | null;
  /** What session/new pre-fills each player's buy-in with. */
  defaultBuyInCents: number;
}

/**
 * The signed-in host's bar settings. One bar per account, as fetchBarId in queries.ts
 * enforces — a second fails loudly rather than editing whichever bar came back first.
 */
export async function fetchBarSettings(): Promise<BarSettings> {
  const { data, error } = await createClient().from('bars')
    .select('id, venmo_note_template, default_buy_in_cents').limit(2);
  if (error) fail(error);
  if (data.length !== 1) throw new Error(`Expected one bar for this account, found ${data.length}`);
  const [bar] = data;
  return { barId: bar.id, venmoNoteTemplate: bar.venmo_note_template, defaultBuyInCents: bar.default_buy_in_cents };
}

/** Save the template; a blank one is stored as `null`, which renders the default. */
export async function updateVenmoNoteTemplate(barId: string, template: string): Promise<void> {
  const venmo_note_template = template.trim() || null;
  const { data, error } = await createClient().from('bars')
    .update({ venmo_note_template }).eq('id', barId).select('id');
  if (error) fail(error);
  // Under RLS only the owner may update a bar (0001 bars_owner_write); a host who is not
  // the owner matches zero rows and gets no error, so say so rather than toast "Saved".
  if (!data?.length) throw new Error('Only the bar owner can change the Venmo note');
}

/** Save the default buy-in; the caller has already refused a blank or negative amount. */
export async function updateDefaultBuyInCents(barId: string, cents: number): Promise<void> {
  const { data, error } = await createClient().from('bars')
    .update({ default_buy_in_cents: cents }).eq('id', barId).select('id');
  if (error) fail(error);
  // Same zero-row refusal as updateVenmoNoteTemplate: RLS lets only the owner update a bar.
  if (!data?.length) throw new Error('Only the bar owner can change the default buy-in');
}

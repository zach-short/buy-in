import type { PostgrestError } from '@supabase/supabase-js';

import { VENMO_NOTE_TEMPLATE_MAX_LENGTH, writeErrorMessage, type Database } from '@pb/core';
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
  /** `null` until the host first saves a default buy-in (BD-6); backs the setup guide's item. */
  defaultBuyInSetAt: string | null;
  /**
   * The app owner's gate (0020, BD-7), set only in the Supabase dashboard — there is
   * deliberately no update function for it, and the database refuses one from a host.
   */
  drinksAllowed: boolean;
  /** The host setup switches (0020). Read them through featureVisibility, not directly. */
  servesDrinks: boolean;
  tracksInventory: boolean;
  /** `null` until the host finishes or dismisses the setup guide; 0020 backfilled existing bars. */
  setupDismissedAt: string | null;
}

/**
 * The signed-in host's bar settings. One bar per account, as fetchBarId in queries.ts
 * enforces — a second fails loudly rather than editing whichever bar came back first.
 * Host screens only: a joined player has no bar of their own, so this throws for them.
 */
export async function fetchBarSettings(): Promise<BarSettings> {
  const { data, error } = await createClient().from('bars')
    .select('id, venmo_note_template, default_buy_in_cents, default_buy_in_set_at, drinks_allowed, serves_drinks, tracks_inventory, setup_dismissed_at')
    .limit(2);
  if (error) fail(error);
  if (data.length !== 1) throw new Error(`Expected one bar for this account, found ${data.length}`);
  const [bar] = data;
  return {
    barId: bar.id,
    venmoNoteTemplate: bar.venmo_note_template,
    defaultBuyInCents: bar.default_buy_in_cents,
    defaultBuyInSetAt: bar.default_buy_in_set_at,
    drinksAllowed: bar.drinks_allowed,
    servesDrinks: bar.serves_drinks,
    tracksInventory: bar.tracks_inventory,
    setupDismissedAt: bar.setup_dismissed_at,
  };
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
  // BD-6: the "set" stamp goes in the same update as the amount, so the two never disagree.
  const { data, error } = await createClient().from('bars')
    .update({ default_buy_in_cents: cents, default_buy_in_set_at: new Date().toISOString() })
    .eq('id', barId).select('id');
  if (error) fail(error);
  // Same zero-row refusal as updateVenmoNoteTemplate: RLS lets only the owner update a bar.
  if (!data?.length) throw new Error('Only the bar owner can change the default buy-in');
}

type SwitchColumns = Pick<Database['public']['Tables']['bars']['Update'],
  'serves_drinks' | 'tracks_inventory' | 'setup_dismissed_at'>;

// The shared body of the host setup writes: the same zero-row refusal as above.
async function updateBar(barId: string, patch: SwitchColumns, refusal: string): Promise<void> {
  const { data, error } = await createClient().from('bars').update(patch).eq('id', barId).select('id');
  if (error) fail(error);
  if (!data?.length) throw new Error(refusal);
}

/** Turning drinks off hides them; it never touches an order already on a tab (0020). */
export async function updateServesDrinks(barId: string, on: boolean): Promise<void> {
  await updateBar(barId, { serves_drinks: on }, 'Only the bar owner can turn drinks on or off');
}

export async function updateTracksInventory(barId: string, on: boolean): Promise<void> {
  await updateBar(barId, { tracks_inventory: on }, 'Only the bar owner can turn inventory on or off');
}

/** Ends the first-run setup guide (host-setup phase 3, BD-5). Nothing calls it before then. */
export async function dismissSetup(barId: string): Promise<void> {
  await updateBar(barId, { setup_dismissed_at: new Date().toISOString() },
    'Only the bar owner can dismiss the setup guide');
}

/**
 * Every drink ever poured at the bar — the number the "turn drinks off" warning names. All of
 * them count toward what people owe, paid or not, so none is left out. Read when the switch
 * is flipped, not on load.
 */
export async function countBarOrders(barId: string): Promise<number> {
  const { count, error } = await createClient().from('orders')
    .select('id', { count: 'exact', head: true }).eq('bar_id', barId);
  if (error) fail(error);
  return count ?? 0;
}

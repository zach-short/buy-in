import { z } from 'zod';

// The two anonymous read paths (DESIGN.md D8, D14, D15), parsed at the boundary. Both RPCs
// return `jsonb`, which the generated types can only call `Json`; parsing is what turns that
// into a shape a page may trust. It also means a projection change in SQL fails loudly here
// rather than rendering `undefined` on a page an anonymous player is looking at.
//
// Mirrors get_shared_tab and get_menu in supabase/migrations/0001_init.sql exactly — named
// columns only (D15). Anything SQL adds later and this does not name is stripped, not passed
// through, so a new column never reaches a public page by accident.

const sharedSession = z.object({
  id: z.string(),
  name: z.string(),
  played_on: z.string(),
  status: z.string(),
  settle_mode: z.string(),
});

const sharedOrder = z.object({
  id: z.string(),
  session_id: z.string(),
  drink_name: z.string(),
  price_cents: z.number().int(),
  paid: z.boolean(),
  created_at: z.string(),
});

const sharedAmount = z.object({
  id: z.string(),
  session_id: z.string(),
  amount_cents: z.number().int(),
  created_at: z.string(),
});

const sharedPayment = z.object({
  id: z.string(),
  session_id: z.string().nullable(),
  amount_cents: z.number().int(),
  direction: z.enum(['received', 'sent']),
  created_at: z.string(),
});

export const sharedTabSchema = z.object({
  scope: z.enum(['portal', 'session']),
  bar: z.object({
    id: z.string(),
    name: z.string(),
    venmo_handle: z.string().nullable(),
    cashapp_handle: z.string().nullable(),
    // Added by 0003. Optional so a database still on 0002, which returns no such key, keeps
    // rendering; absent and null both mean the default note.
    venmo_note_template: z.string().nullable().optional(),
  }),
  player: z.object({ id: z.string(), name: z.string() }),
  sessions: z.array(sharedSession),
  orders: z.array(sharedOrder),
  buy_ins: z.array(sharedAmount),
  cashouts: z.array(sharedAmount),
  payments: z.array(sharedPayment),
});

export type SharedTab = z.infer<typeof sharedTabSchema>;
export type SharedTabScope = SharedTab['scope'];

export const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price_cents: z.number().int(),
  available: z.boolean(),
});

export type MenuItem = z.infer<typeof menuItemSchema>;

export function parseSharedTab(data: unknown): SharedTab {
  return sharedTabSchema.parse(data);
}

export function parseMenu(data: unknown): MenuItem[] {
  return z.array(menuItemSchema).parse(data);
}

/**
 * A link's scope decides which page may render it (D15): a receipt link is one night, a
 * portal link is the whole history. A page shown the other kind treats it as invalid rather
 * than rendering one night as a balance or a history as one night.
 */
export function requireScope(tab: SharedTab, scope: SharedTabScope): SharedTab {
  if (tab.scope !== scope) throw new Error(`expected a ${scope} link, got a ${tab.scope} link`);
  return tab;
}

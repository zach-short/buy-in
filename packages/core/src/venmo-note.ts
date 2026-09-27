// The host-editable Venmo note. The owner decided on 2026-09-27 that the note is no
// longer DESIGN.md D12's fixed `Buy-In — <session name>`: the default is plain `Buy-In`,
// and a host may set a template of their own. Owner's words: "I don't want to show the
// balance by default in a venmo note" — so the amount appears only when the host's
// template asks for it with `{{amount}}`, never otherwise.
//
// venmo.ts's venmoNote/VENMO_NOTE_PREFIX are left untouched because other call sites
// import them today; this module is additive, and wiring it into the pay buttons is a
// later step.

import { formatCents } from './money';

export const DEFAULT_VENMO_NOTE = 'Buy-In';

/**
 * Longest template a host may save. Mirrors the `bars_venmo_note_template_len` check in
 * supabase/migrations/0003_venmo_note_template.sql — change both or neither.
 */
export const VENMO_NOTE_TEMPLATE_MAX_LENGTH = 120;

export interface VenmoNoteVars {
  amountCents: number;
  sessionName?: string;
}

const TAG = /\{\{\s*([a-z]+)\s*\}\}/gi;

// A separator is punctuation standing between two parts of the note. When there is no
// session to name, the `{{session}}` slot is removed together with one separator next to
// it, so `Buy-In — {{session}}` reads `Buy-In`, not `Buy-In —`.
const SEP = String.raw`\s*[—–\-:|·,/]\s*`;
const SESSION = String.raw`\{\{\s*session\s*\}\}`;
const SESSION_AFTER_SEP = new RegExp(`${SEP}${SESSION}`, 'gi');
const SESSION_BEFORE_SEP = new RegExp(`${SESSION}(${SEP})?`, 'gi');

function dropSessionSlot(template: string): string {
  return template.replace(SESSION_AFTER_SEP, '').replace(SESSION_BEFORE_SEP, ' ');
}

function tagValues(vars: VenmoNoteVars): Readonly<Record<string, string>> {
  return {
    amount: `$${formatCents(Math.abs(vars.amountCents))}`,
    ...(vars.sessionName?.trim() ? { session: vars.sessionName.trim() } : {}),
  };
}

/**
 * The note for one payment. A null or blank template means the default, `Buy-In`.
 * `{{amount}}` and `{{session}}` are replaced (case and inner spaces ignored); any other
 * `{{tag}}` is left as typed, so a typo shows up in the preview instead of vanishing.
 * Replacement is one pass, so a session named `{{amount}}` is not expanded again.
 */
export function renderVenmoNote(template: string | null | undefined, vars: VenmoNoteVars): string {
  if (!template?.trim()) return DEFAULT_VENMO_NOTE;
  const values = tagValues(vars);
  const source = values.session ? template : dropSessionSlot(template);
  const note = source
    .replace(TAG, (tag, name: string) => values[name.toLowerCase()] ?? tag)
    .replace(/\s+/g, ' ')
    .trim();
  return note || DEFAULT_VENMO_NOTE;
}

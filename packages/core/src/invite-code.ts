// Table invite codes (0028; docs/incomplete/invite-codes/SCOPE.md). A code is a short alias for
// an invite's token, typed on /join. The database is the authority on every rule here: these
// mirror its checks so a screen can answer before a round trip, never instead of one.

export type InviteKind = 'link' | 'code' | 'both';

/** Whether an invite's code can be typed right now. 'none' is a link-only invite. */
export type CodeStatus = 'none' | 'live' | 'lapsed';

/** Generated codes are digits of this length (A5); 0028's create_table_invite checks the same range. */
export const GENERATED_CODE_LENGTHS = [4, 5, 6] as const;

export type GeneratedCodeLength = (typeof GENERATED_CODE_LENGTHS)[number];

// A host's own code is 4–8 letters or digits, stored upper-cased (0028 bar_invite_links_code_shape).
const CUSTOM_CODE = /^[A-Z0-9]{4,8}$/;

// A token is 24 random bytes as hex (0004). Nothing a code can be is 48 characters long.
const TOKEN = /^[0-9a-f]{48}$/;

/** The code as the database stores it: trimmed and upper-cased. */
export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidCustomCode(input: string): boolean {
  return CUSTOM_CODE.test(normalizeInviteCode(input));
}

/** What /join's box holds: a pasted token (the old "code") or a short code. */
export function isInviteToken(input: string): boolean {
  return TOKEN.test(input.trim());
}

export function hasCode(kind: InviteKind): boolean {
  return kind !== 'link';
}

interface CodeFields {
  kind: InviteKind;
  code: string | null;
  code_expires_at: string | null;
}

export function codeStatus(invite: CodeFields, now: Date): CodeStatus {
  if (!hasCode(invite.kind)) return 'none';
  // 0028 nulls a lapsed code lazily, so a code still present may already be past its time.
  const live = invite.code !== null && invite.code_expires_at !== null && new Date(invite.code_expires_at) > now;
  return live ? 'live' : 'lapsed';
}

interface ShareParts {
  kind: InviteKind;
  link: string;
  code: string | null;
  joinPage: string;
}

/**
 * What Share sends. The owner chose the plain register on 2026-09-29 (SCOPE A4) for a link with a
 * code; the link-only and code-only lines are that sentence with the missing half left out. A
 * link-only invite still goes out bare, as every other link in the app does (web/lib/share.ts).
 */
export function inviteShareText({ kind, link, code, joinPage }: ShareParts): string {
  if (kind === 'link' || code === null) return link;
  if (kind === 'code') return `Join my poker table on Buy-In: enter code ${code} at ${joinPage}`;
  return `Join my poker table on Buy-In: ${link} — or enter code ${code} at ${joinPage}`;
}

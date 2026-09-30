// Table invite codes (0028; docs/incomplete/invite-codes/SCOPE.md). A code is a short alias for
// an invite's token, typed on /join. The database is the authority on every rule here: these
// mirror its checks so a screen can answer before a round trip, never instead of one.

export type InviteKind = 'link' | 'code' | 'both';

/** Whether an invite's code can be typed right now. 'none' is a link-only invite. */
export type CodeStatus = 'none' | 'live' | 'lapsed';

/** Generated codes are digits of this length (A5); 0028's create_table_invite checks the same range. */
export const GENERATED_CODE_LENGTHS = [4, 5, 6] as const;

export type GeneratedCodeLength = (typeof GENERATED_CODE_LENGTHS)[number];

/** How long a link or a code works (SCOPE A11); 0030 stores the same keys and checks the same list. */
export const INVITE_LIFETIMES = ['1h', '24h', '7d', '30d', 'never'] as const;

export type InviteLifetime = (typeof INVITE_LIFETIMES)[number];

export const INVITE_LIFETIME_LABELS: Readonly<Record<InviteLifetime, string>> = {
  '1h': '1 hour',
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
  never: 'Never',
};

// 0030 stores "never" as Postgres 'infinity', which PostgREST sends as that word. new Date() reads
// it as Invalid Date, and every comparison with Invalid Date is false — so it must be caught first.
const NEVER = 'infinity';

/** Whether a stored expiry means the thing never expires. */
export function neverExpires(timestamp: string): boolean {
  return timestamp === NEVER;
}

/** Whether a stored expiry has passed. 'infinity' never has. */
export function hasLapsed(timestamp: string, now: Date): boolean {
  return !neverExpires(timestamp) && new Date(timestamp) <= now;
}

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
  const live = invite.code !== null && invite.code_expires_at !== null && !hasLapsed(invite.code_expires_at, now);
  return live ? 'live' : 'lapsed';
}

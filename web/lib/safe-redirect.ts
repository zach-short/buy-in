// Multiple auth-adjacent pages (login, signup, join, rsvp) pass a `redirect` search
// param so a visitor detouring through sign-in/sign-up lands back where they started
// (e.g. an invite code on /join). Only a same-origin relative path is ever honoured —
// anything else (a protocol-relative `//host`, an absolute URL, or missing) falls back
// to `fallback`, so this can never become an open redirect.
export function safeRedirectPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

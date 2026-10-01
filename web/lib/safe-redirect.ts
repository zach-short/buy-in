import { isSafePath } from '@pb/core';

// Five callers carry a return path in the URL, so a visitor detouring through sign-in or a
// mail link lands back where they started (e.g. an invite code on /join): login's `redirect`
// (`hooks/use-login.ts`), welcome's `next` (`hooks/use-welcome.ts`), confirm-email's `next`
// (`app/confirm-email/page.tsx`), the auth callback (`app/auth/callback/route.ts`: `next`, or
// the path `rememberNext` in `lib/supabase/pending-next.ts` stored for an OAuth or sign-up
// return) and the reset link's `next`
// (`app/auth/confirm/verify-recovery.ts`). A target `isSafePath` refuses falls back to
// `fallback`. It refuses anything that does not start with a single `/` (a protocol-relative
// `//host`, an absolute URL, a missing value), a `\`, C0 control character or DEL anywhere,
// and an empty segment (`//`) or a `.`/`..` segment (dots literal or `%2e`) before the first
// `?` or `#`. Its doc comment in @pb/core says how each of those leaves the site, and a gap
// found later is closed there, for every caller at once.
//
// Owner, 2026-09-30 (PASSOFF item 37 audit, finding B1): a `\` or a control character
// anywhere also falls back. Browsers read `\` as `/` in an https URL and drop tab and
// newline, so `/\evil.example` and `/<TAB>/evil.example` went to evil.example, through
// the reset link's `next` (with an attacker's own token) and `/login?redirect=`. The rule
// lives in @pb/core (`isSafePath`) so a native client shares it.
export function safeRedirectPath(raw: string | null | undefined, fallback: string): string {
  return raw && isSafePath(raw) ? raw : fallback;
}

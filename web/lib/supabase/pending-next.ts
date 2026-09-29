// Where a visitor was headed before the interim /auth/callback hop (Google, or the confirm-email
// link). Supabase honours `redirectTo` only if it is in the project's redirect allow-list; when it
// is not, it sends the browser to the Site URL with a bare ?code= and the `?next=` riding on
// redirectTo is lost — an invite link then ends at home. A cookie survives that fallback, so the
// callback reads it when the query has no `next`.
export const PENDING_NEXT_COOKIE = 'pb_next';

const ONE_HOUR_S = 3600;

/** Client-side. A plain '/' clears it, so an abandoned invite cannot hijack a later ordinary sign-in. */
export function rememberNext(next: string): void {
  const keep = next !== '/';
  const value = keep ? encodeURIComponent(next) : '';
  document.cookie = `${PENDING_NEXT_COOKIE}=${value}; path=/; max-age=${keep ? ONE_HOUR_S : 0}; samesite=lax`;
}

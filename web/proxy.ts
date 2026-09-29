import type { NextRequest } from 'next/server';

import { passThrough, redirectTo, updateSession } from '@/lib/supabase/middleware';

// DESIGN.md §8.2: exactly these stay reachable without a login — the same six predicates the
// NextAuth proxy had (web/proxy.ts:8-14 as of 2026-09-16). D8 and D14 change how these pages
// read their data, never which of them are public; adding a line here is an owner decision.
//
// 2026-09-29: /opengraph-image added — link-preview bots carry no session, and a 307 to /login
// on the card image would leave every shared link without a picture. Static, no data.
//
// 2026-09-28, onboarding feature: /signup, /join and /rsvp added. /join and /join/[token] must
// be public — the whole point is a brand-new visitor with no account yet clicking an invite
// link; each page does its own signed-in check client-side and bounces to /signup?redirect=...
// when needed. Same reasoning for /rsvp/[token]. /invites, /schedule and /performance stay
// behind login — they're host- or member-account-scoped, never link-only.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/opengraph-image' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/confirm-email' ||
    pathname === '/auth/callback' ||
    pathname === '/join' ||
    pathname.startsWith('/join/') ||
    pathname.startsWith('/rsvp/') ||
    pathname.startsWith('/menu') ||
    pathname.startsWith('/receipt') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/player-receipt')
  );
}

export async function proxy(request: NextRequest) {
  const { isSignedIn, write } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!isPublicPath(pathname) && !isSignedIn) {
    return redirectTo(request, '/login', write);
  }

  if ((pathname === '/login' || pathname === '/signup' || pathname === '/confirm-email') && isSignedIn) {
    return redirectTo(request, '/', write);
  }

  return passThrough(request, write);
}

// `api/auth` left the exclusion list with NextAuth's route handler, the only thing it existed for.
// The PWA worker files are static and must never redirect: a browser refuses to register a
// service worker whose script answers 3xx, and /sw.js answered 307 → /login to every
// logged-out visitor on the live site (HANDOFF step 28, 2026-09-27).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw\\.js|swe-worker-|workbox-).*)'],
};

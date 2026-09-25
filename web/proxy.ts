import type { NextRequest } from 'next/server';

import { passThrough, redirectTo, updateSession } from '@/lib/supabase/middleware';

// DESIGN.md §8.2: exactly these stay reachable without a login — the same six predicates the
// NextAuth proxy had (web/proxy.ts:8-14 as of 2026-09-16). D8 and D14 change how these pages
// read their data, never which of them are public; adding a line here is an owner decision.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/login' ||
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

  if (pathname === '/login' && isSignedIn) {
    return redirectTo(request, '/', write);
  }

  return passThrough(request, write);
}

// `api/auth` left the exclusion list with NextAuth's route handler, the only thing it existed for.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
};

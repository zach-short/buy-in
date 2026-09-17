import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/menu') ||
    pathname.startsWith('/receipt') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/player-receipt');

  if (!isPublic && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname === '/login' && isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|api/auth).*)'],
};

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@pb/core';
import { clientEnv } from '@/lib/env/client';

type AuthWrite = {
  cookies: { name: string; value: string; options: CookieOptions }[];
  headers: Record<string, string>;
};

export type SessionCheck = { isSignedIn: boolean; write: AuthWrite };

// BD-5 (PLAN.md §1): the proxy half of the client module. Refreshes an expiring session and
// reports whether the request is signed in; what to do about it is proxy.ts's call.
export async function updateSession(request: NextRequest): Promise<SessionCheck> {
  const write: AuthWrite = { cookies: [], headers: {} };
  const supabase = createServerClient<Database>(
    clientEnv.supabaseUrl,
    clientEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Onto the request as well as the response, so anything rendered for this same request
          // already sees the refreshed session rather than the expired one.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          write.cookies = cookiesToSet;
          write.headers = headers;
        },
      },
    },
  );

  // Nothing may run between creating the client and this call: getClaims is what triggers the
  // refresh, and a refresh that lands after the response is built is lost (@supabase/ssr 0.12.7,
  // CookieMethodsServer.setAll).
  const { data } = await supabase.auth.getClaims();
  return { isSignedIn: data?.claims != null, write };
}

export function passThrough(request: NextRequest, write: AuthWrite): NextResponse {
  return withAuthWrite(NextResponse.next({ request }), write);
}

export function redirectTo(request: NextRequest, path: string, write: AuthWrite): NextResponse {
  return withAuthWrite(NextResponse.redirect(new URL(path, request.url)), write);
}

// A redirect carries the refreshed cookies too, or a token rotated on this hop is thrown away and
// the next request refreshes again. The headers are @supabase/ssr's no-store set: a response
// that writes one user's session must never be served from a CDN cache to another.
function withAuthWrite(response: NextResponse, write: AuthWrite): NextResponse {
  write.cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  Object.entries(write.headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

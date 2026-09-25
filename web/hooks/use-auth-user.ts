'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

export type AuthUserState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated'; user: null };

// Replaces NextAuth's SessionProvider + useSession (DESIGN.md D5: replaced, not ported). For what
// the UI shows only — proxy.ts is what keeps a logged-out visitor off a protected page.
export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ status: 'loading', user: null });

  useEffect(() => {
    // INITIAL_SESSION fires on subscribe, so this one listener covers the first render as well as
    // every later sign-in, sign-out and token refresh.
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      setState(
        session
          ? { status: 'authenticated', user: session.user }
          : { status: 'unauthenticated', user: null },
      );
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

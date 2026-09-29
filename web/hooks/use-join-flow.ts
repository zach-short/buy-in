'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { checkSignIn, displayNameOf, joinBarAsPlayer, loginPath, type JoinFailure } from '@/lib/supabase/join';

// A successful join stays on 'joining' and 'redirecting' is the detour to /login: both hold
// the screen still while router.replace navigates, so nothing can be resubmitted mid-unload.
export type JoinStep = 'idle' | 'checking' | 'redirecting' | 'naming' | 'joining';

const UNREACHABLE = "Couldn't reach Buy-In. Check your connection and try again.";

const JOIN_ERRORS: Record<JoinFailure, string> = {
  'invalid-invite': "That invite didn't work — it may be mistyped, expired or revoked. Ask your host for a new one.",
  'name-taken': 'Someone at this table already goes by that name. Try another.',
  unreachable: UNREACHABLE,
};

/** The invite flow both /join pages share: sign-in check, then a display name, then the join RPC. */
export function useJoinFlow(initialStep: JoinStep = 'idle') {
  const router = useRouter();
  const [step, setStep] = useState<JoinStep>(initialStep);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Stable across renders (useRouter is), so the token page can run it from an effect.
  const begin = useCallback(
    async (returnTo: string) => {
      setStep('checking');
      setError('');
      const check = await checkSignIn();
      if (check.status === 'signed-out') {
        setStep('redirecting');
        router.replace(loginPath(returnTo));
      } else if (check.status === 'unreachable') {
        setStep('idle');
        setError(UNREACHABLE);
      } else {
        setName(displayNameOf(check.user));
        setStep('naming');
      }
    },
    [router],
  );

  async function join(token: string) {
    const trimmed = name.trim();
    if (!trimmed) return setError('Enter the name your host will see.');
    setStep('joining');
    setError('');
    const result = await joinBarAsPlayer(token, trimmed);
    if (result.ok) return router.replace('/');
    setStep('naming');
    setError(JOIN_ERRORS[result.reason]);
  }

  function reset() {
    setStep('idle');
    setError('');
  }

  return { step, name, setName, error, begin, join, reset };
}

export type JoinFlow = ReturnType<typeof useJoinFlow>;

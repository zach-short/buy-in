'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { isInviteToken } from '@pb/core';
import { checkSignIn, loginPath, resolveInviteCode, type CodeFailure } from '@/lib/supabase/join';

// 'checking' also holds the screen after a code resolves, while router.replace navigates, so the
// box cannot be resubmitted mid-unload (use-join-flow.ts's reason).
export type CodeEntryStep = 'idle' | 'checking' | 'redirecting';

// Copy is the owner's (R7, the terse set, 2026-09-29); unreachable is use-join-flow.ts's line.
const CODE_ERRORS: Record<CodeFailure, string> = {
  'invalid-code': "That code doesn't work.",
  'too-many-tries': 'Too many tries. Wait a few minutes and try again.',
  unreachable: "Couldn't reach Buy-In. Check your connection and try again.",
};

/**
 * /join's box (SCOPE BD-2). A pasted 48-hex token goes straight to /join/<token>. A short code needs
 * a signed-in account, because resolve_invite_code charges every wrong try to one (0028), so a
 * signed-out visitor goes to /login and comes back to /join?code=. Once resolved, the token page
 * runs the claim picker exactly as it does for a clicked link.
 */
export function useInviteCodeEntry(initialCode: string) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [step, setStep] = useState<CodeEntryStep>('idle');
  const [error, setError] = useState('');

  const submit = useCallback(async (typed: string) => {
    const trimmed = typed.trim();
    if (!trimmed) return;
    setError('');
    if (isInviteToken(trimmed)) return router.replace(`/join/${trimmed}`);
    setStep('checking');
    const check = await checkSignIn();
    if (check.status === 'signed-out') {
      setStep('redirecting');
      return router.replace(loginPath(`/join?${new URLSearchParams({ code: trimmed })}`));
    }
    const result = check.status === 'unreachable' ? null : await resolveInviteCode(trimmed);
    if (result?.ok) return router.replace(`/join/${result.token}`);
    setStep('idle');
    setError(CODE_ERRORS[result?.reason ?? 'unreachable']);
  }, [router]);

  return { code, setCode, step, error, submit };
}

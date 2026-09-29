'use client';

import { useState } from 'react';

import { useAuthUser } from '@/hooks/use-auth-user';
import { deleteMyAccount, fetchDeletionCheck, type DeletionCheck } from '@/lib/supabase/account-deletion';
import { signOutToLanding } from '@/lib/supabase/sign-out';

// closed → loading → blocked | warn | confirm. `warn` is the second warning, shown only when the
// house owes this account money; it sits before `confirm` so a person is never asked to type their
// email for something they have not been told will cost them.
export type DeleteStep = 'closed' | 'loading' | 'blocked' | 'warn' | 'confirm' | 'deleting';

export interface DeleteAccountState {
  step: DeleteStep;
  check: DeletionCheck | null;
  email: string;
  typed: string;
  setTyped: (value: string) => void;
  /** Case and surrounding spaces are ignored: the point is deliberateness, not exactness. */
  matches: boolean;
  error: string | null;
  open: () => Promise<void>;
  cancel: () => void;
  continueAnyway: () => void;
  remove: () => Promise<void>;
}

function nextStep(check: DeletionCheck): DeleteStep {
  if (check.owes.length || check.barsWithHistory.length) return 'blocked';
  return check.owed.length ? 'warn' : 'confirm';
}

export function useDeleteAccount(): DeleteAccountState {
  const auth = useAuthUser();
  const [step, setStep] = useState<DeleteStep>('closed');
  const [check, setCheck] = useState<DeletionCheck | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const email = auth.user?.email ?? '';

  async function open() {
    setError(null);
    setStep('loading');
    try {
      const result = await fetchDeletionCheck();
      setCheck(result);
      setStep(nextStep(result));
    } catch (e) {
      setError((e as Error).message);
      setStep('closed');
    }
  }

  function cancel() {
    setStep('closed');
    setTyped('');
    setError(null);
  }

  async function remove() {
    setError(null);
    setStep('deleting');
    try {
      await deleteMyAccount();
    } catch (e) {
      setError((e as Error).message);
      setStep('confirm');
      return;
    }
    await signOutToLanding();
  }

  return {
    step, check, email, typed, setTyped, error, open, cancel, remove,
    matches: email !== '' && typed.trim().toLowerCase() === email.toLowerCase(),
    continueAnyway: () => setStep('confirm'),
  };
}

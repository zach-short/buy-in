'use client';

import { useState, type FormEvent, type SyntheticEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { safeRedirectPath } from '@/lib/safe-redirect';
import { createClient } from '@/lib/supabase/client';
import { emailHasAccount } from '@/lib/supabase/email-lookup';
import { afterSignIn, welcomePath } from '@/lib/supabase/new-account';
import { cameFromExpiredLink, sendPasswordReset } from '@/lib/supabase/password-reset';
import { completePendingBar } from '@/lib/supabase/pending-bar';
import { createAccount } from '@/lib/supabase/sign-up';

// One flow for signing in and signing up (owner, 2026-09-29): pick Google or email; an email
// with an account asks for its password, a new one sets a password, and either way a new
// account goes on to /welcome for the host-or-member choice, name and Venmo.
// `reset` asks for an address after a used or expired reset link; `reset-sent` is check-your-email.
export type LoginStep = 'start' | 'email' | 'password' | 'create' | 'reset' | 'reset-sent';

// Which action is running, so only its own button says so.
type Working = 'reset' | 'other' | null;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

function confirmEmailPath(email: string, next: string): string {
  return `/confirm-email?${new URLSearchParams({ email: email.trim(), next })}`;
}

export function useLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Same-origin only (safeRedirectPath): an invite, event link or code survives the detour.
  const next = safeRedirectPath(searchParams.get('redirect'), '/');
  const [step, setStep] = useState<LoginStep>(() => (cameFromExpiredLink(searchParams) ? 'reset' : 'start'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState<Working>(null);

  function goTo(target: LoginStep): void {
    setStep(target);
    setPassword('');
    setConfirmPassword('');
    setError('');
  }

  // Stays busy on success so nothing can be resubmitted while the route changes.
  async function run(work: () => Promise<void>, kind: Working = 'other'): Promise<void> {
    setWorking(kind);
    setError('');
    try {
      await work();
    } catch (err) {
      setError(messageOf(err));
      setWorking(null);
    }
  }

  function checkEmail(e: FormEvent): Promise<void> {
    e.preventDefault();
    return run(async () => {
      goTo((await emailHasAccount(email)) ? 'password' : 'create');
      setWorking(null);
    });
  }

  // From the password step's "Forgot password?" button and from the `reset` step's form. The
  // same screen follows whether or not the address has an account, and when the send is rate
  // limited (sendPasswordReset).
  function sendReset(e?: SyntheticEvent): Promise<void> {
    e?.preventDefault();
    return run(async () => {
      await sendPasswordReset(email);
      goTo('reset-sent');
      setWorking(null);
    }, 'reset');
  }

  function signIn(e: FormEvent): Promise<void> {
    e.preventDefault();
    return run(async () => {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      // A Google-only account has no password, so it lands here too.
      if (signInError) throw new Error('Wrong password. If you signed up with Google, use the Google button.');
      // A host who confirmed their email on another device has no table yet; see pending-bar.ts.
      await completePendingBar(supabase).catch(() => undefined);
      router.replace(await afterSignIn(supabase, next));
    });
  }

  function signUp(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (password !== confirmPassword) return Promise.resolve(setError('Passwords do not match.'));
    return run(async () => {
      const welcome = welcomePath(next);
      const result = await createAccount(email, password, welcome);
      router.replace(result === 'confirm-email' ? confirmEmailPath(email, welcome) : welcome);
    });
  }

  return {
    step, goTo, next, email, setEmail, password, setPassword, confirmPassword, setConfirmPassword,
    error, busy: working !== null, sendingReset: working === 'reset', checkEmail, signIn, signUp, sendReset,
  };
}

export type LoginFlow = ReturnType<typeof useLogin>;

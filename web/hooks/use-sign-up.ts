'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { createAccount, type AccountFields } from '@/lib/supabase/sign-up';
import { safeRedirectPath } from '@/lib/safe-redirect';

export interface SignUpFields extends AccountFields {
  confirmPassword: string;
}

export type SignUpStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

export interface SignUpState {
  fields: SignUpFields;
  setField: <K extends keyof SignUpFields>(key: K, value: SignUpFields[K]) => void;
  status: SignUpStatus;
  submit: (e: FormEvent) => Promise<void>;
  // True when a ?redirect= sent this visitor here (from /join or /rsvp). They are joining a
  // table, so they skip /welcome's host-or-player choice and arrive as a player.
  invited: boolean;
}

const EMPTY: SignUpFields = { name: '', email: '', password: '', confirmPassword: '' };

// Nobody has chosen a role yet: /welcome asks, for email sign-ups exactly as for Google's.
const DEFAULT_NEXT = '/welcome';

function confirmEmailPath(email: string, next: string): string {
  return `/confirm-email?${new URLSearchParams({ email: email.trim(), next })}`;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

// `required` lets whitespace through.
function problemWith(fields: SignUpFields): string | null {
  if (!fields.name.trim()) return 'Enter your name.';
  if (fields.password !== fields.confirmPassword) return 'Passwords do not match.';
  return null;
}

export function useSignUp(): SignUpState {
  const router = useRouter();
  // A ?redirect= (e.g. from /join or /rsvp bouncing a signed-out visitor here) always
  // wins over /welcome — it's how an invite code or event link survives the detour through
  // account creation. Same-origin only; see safeRedirectPath.
  const searchParams = useSearchParams();
  const invited = Boolean(searchParams.get('redirect'));
  // Lazy initializer: read the param once, on mount, not on every render.
  // /login carries the address it already asked for.
  const [fields, setFields] = useState<SignUpFields>(() => ({ ...EMPTY, email: searchParams.get('email') ?? '' }));
  const [status, setStatus] = useState<SignUpStatus>({ kind: 'idle' });

  function setField<K extends keyof SignUpFields>(key: K, value: SignUpFields[K]): void {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  // Status stays `submitting` on success, so the button stays disabled while the route changes.
  async function run(): Promise<void> {
    const next = safeRedirectPath(searchParams.get('redirect'), DEFAULT_NEXT);
    const result = await createAccount(fields, next);
    router.replace(result === 'confirm-email' ? confirmEmailPath(fields.email, next) : next);
  }

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const problem = problemWith(fields);
    if (problem) return setStatus({ kind: 'error', message: problem });
    setStatus({ kind: 'submitting' });
    await run().catch((err: unknown) => setStatus({ kind: 'error', message: messageOf(err) }));
  }

  return { fields, setField, status, submit, invited };
}

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { createAccount, type AccountFields, type BarFields } from '@/lib/supabase/sign-up';
import { createClient } from '@/lib/supabase/client';
import { completePendingBar } from '@/lib/supabase/pending-bar';
import { safeRedirectPath } from '@/lib/safe-redirect';

export type Role = 'host' | 'member';

export interface SignUpFields extends AccountFields, BarFields {
  confirmPassword: string;
  role: Role | null;
}

export type SignUpStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

export interface SignUpState {
  fields: SignUpFields;
  setField: <K extends keyof SignUpFields>(key: K, value: SignUpFields[K]) => void;
  status: SignUpStatus;
  accountCreated: boolean;
  submit: (e: FormEvent) => Promise<void>;
  // True when a ?redirect= sent this visitor here (from /join or /rsvp). Nobody clicking an
  // invite link is trying to start their own table, so the page skips the role picker
  // entirely rather than risk someone picking "host" by mistake.
  invited: boolean;
}

const EMPTY: SignUpFields = { name: '', email: '', password: '', confirmPassword: '', role: null, barName: '', venmo: '', cashapp: '' };

// A host's new bar is the dashboard at `/`. A member belongs to no bar until an invite
// code admits them, which `/join` asks for.
const NEXT_PATH: Record<Role, string> = { host: '/', member: '/join' };

function confirmEmailPath(email: string, next: string): string {
  return `/confirm-email?${new URLSearchParams({ email: email.trim(), next })}`;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

// `required` lets whitespace through, and a blank bar name would be stored as-is.
function problemWith(fields: SignUpFields, role: Role): string | null {
  if (!fields.name.trim()) return 'Enter your name.';
  if (fields.password !== fields.confirmPassword) return 'Passwords do not match.';
  if (role === 'host' && !fields.barName.trim()) return 'Name your table.';
  return null;
}

// The table's fields went into the account's metadata at sign-up; this reads them back, creates
// the table and clears them, so a later sign-in does not create a second one.
async function createBarForNewAccount(): Promise<void> {
  try {
    await completePendingBar(createClient());
  } catch (err) {
    throw new Error(`Your account is ready, but the table was not set up: ${messageOf(err)} Try again.`);
  }
}

export function useSignUp(): SignUpState {
  const router = useRouter();
  // A ?redirect= (e.g. from /join or /rsvp bouncing a signed-out visitor here) always
  // wins over the role's own default — it's how an invite code or event link survives
  // the detour through account creation. Same-origin only; see safeRedirectPath.
  const searchParams = useSearchParams();
  const invited = Boolean(searchParams.get('redirect'));
  // Lazy initializer: read the param once, on mount, not on every render.
  const [fields, setFields] = useState<SignUpFields>(() => ({
    ...EMPTY,
    // /login carries the address it already asked for.
    email: searchParams.get('email') ?? '',
    role: invited ? 'member' : null,
  }));
  const [status, setStatus] = useState<SignUpStatus>({ kind: 'idle' });
  // Survives a failed create_bar so a retry skips signUp: the address is registered by
  // then, and a second signUp would be refused as "User already registered".
  const [accountCreated, setAccountCreated] = useState(false);

  function setField<K extends keyof SignUpFields>(key: K, value: SignUpFields[K]): void {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  // Status stays `submitting` on the confirm-email hand-off too: the route is changing.
  async function run(role: Role): Promise<void> {
    const next = safeRedirectPath(searchParams.get('redirect'), NEXT_PATH[role]);
    if (!accountCreated) {
      const pendingBar = role === 'host' ? { barName: fields.barName, venmo: fields.venmo, cashapp: fields.cashapp } : null;
      const result = await createAccount(fields, { next, pendingBar });
      if (result === 'confirm-email') return router.replace(confirmEmailPath(fields.email, next));
      setAccountCreated(true);
    }
    if (role === 'host') await createBarForNewAccount();
    router.replace(next);
  }

  // Status stays `submitting` on success, so the button stays disabled while the route changes.
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    // Belt and suspenders: the page hides the picker while invited, so fields.role can't
    // actually become 'host' here — but an invite always means "join", never "host",
    // whatever the picker does or doesn't render.
    const role = invited ? 'member' : fields.role;
    // The page disables submit, and with it Enter-to-submit, until a role is chosen.
    if (!role) return;
    const problem = problemWith(fields, role);
    if (problem) return setStatus({ kind: 'error', message: problem });
    setStatus({ kind: 'submitting' });
    await run(role).catch((err: unknown) => setStatus({ kind: 'error', message: messageOf(err) }));
  }

  return { fields, setField, status, accountCreated, submit, invited };
}

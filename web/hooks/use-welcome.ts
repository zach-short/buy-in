'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { formatPhone, validatePhone } from '@pb/core';

import type { Role } from '@/components/auth/role-picker';
import type { WelcomeProgress } from '@/components/auth/welcome-progress';
import { useAuthUser } from '@/hooks/use-auth-user';
import { useIsBarStaff } from '@/hooks/use-is-bar-staff';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { displayNameOf } from '@/lib/supabase/join';
import { normalizeVenmo, validateHandles } from '@/lib/supabase/payment-handles';
import { acceptInvite, createHostTable, saveProfile, type Profile } from '@/lib/supabase/welcome';

// A new account's first steps, after /login or Google (owner, 2026-09-29): host or member,
// then name and optional Venmo and phone, then — for a host — the table, after which home's setup guide
// takes over. A `next` (an invite or event link) means they came to join, so the role is
// member and the choice is skipped. Account's "Host your own table" arrives with ?role=host.
export type WelcomeStep = 'role' | 'profile' | 'table';

function metaVenmo(user: User | null): string {
  const venmo: unknown = user?.user_metadata.venmo;
  return typeof venmo === 'string' ? venmo : '';
}

function metaPhone(user: User | null): string {
  const phone: unknown = user?.user_metadata.phone;
  return typeof phone === 'string' ? phone : '';
}

function profileProblem(profile: Profile): { message: string; field: ErrorField } | null {
  if (!profile.name.trim()) return { message: 'Enter your name.', field: 'name' };
  const message = validateHandles(profile.venmo, '');
  if (message) return { message, field: 'venmo' };
  const phoneMessage = validatePhone(profile.phone);
  return phoneMessage ? { message: phoneMessage, field: 'phone' } : null;
}

// A host has all three steps and a member has no table; an invite or ?role=host skips the role
// step. Before a role is picked the bar assumes the longer host path, so choosing member shortens it.
function progressOf(step: WelcomeStep, role: Role | null, skipsRole: boolean): WelcomeProgress {
  const steps: WelcomeStep[] = ['role', 'profile'];
  if (role !== 'member') steps.push('table');
  const shown = skipsRole ? steps.slice(1) : steps;
  return { steps: shown, current: shown.indexOf(step) };
}

// Which input a message belongs to, so the page can mark it; a failure from the server, which
// names no field, marks none.
export type ErrorField = 'name' | 'venmo' | 'phone' | 'table';

export function useWelcome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get('next'), '/');
  const invited = next !== '/';
  const presetRole: Role | null = invited ? 'member' : searchParams.get('role') === 'host' ? 'host' : null;
  const { user } = useAuthUser();
  const isHost = useIsBarStaff();
  const [role, setRole] = useState<Role | null>(presetRole);
  const [step, setStep] = useState<WelcomeStep>(presetRole ? 'profile' : 'role');
  // null until typed in, so what Google or an earlier visit saved shows without an effect.
  const [name, setName] = useState<string | null>(null);
  const [venmo, setVenmo] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [tableName, setTableName] = useState('');
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<ErrorField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const venmoInput = venmo ?? metaVenmo(user);
  const phoneInput = phone ?? formatPhone(metaPhone(user));
  const profile: Profile = {
    name: name ?? (user ? displayNameOf(user) : ''),
    venmo: normalizeVenmo(venmoInput),
    phone: formatPhone(phoneInput),
  };

  // Someone who already runs a table has nothing to choose; a second one is not what they came for.
  useEffect(() => {
    if (isHost) router.replace('/');
  }, [isHost, router]);

  function fail(message: string, field: ErrorField | null): void {
    setError(message);
    setErrorField(field);
  }

  function goTo(target: WelcomeStep): void {
    fail('', null);
    setStep(target);
  }

  function choose(picked: Role): void {
    setRole(picked);
    goTo('profile');
  }

  // Stays `submitting` on success so the button holds still while the route changes.
  async function run(work: () => Promise<void>): Promise<void> {
    setSubmitting(true);
    fail('', null);
    try {
      await work();
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Something went wrong.', null);
      setSubmitting(false);
    }
  }

  async function submitProfile(e: FormEvent): Promise<void> {
    e.preventDefault();
    const problem = profileProblem(profile);
    if (problem) return fail(problem.message, problem.field);
    if (role === 'host') return goTo('table');
    await run(async () => {
      await saveProfile(profile);
      router.replace(invited ? await acceptInvite(next, profile.name) : '/join');
    });
  }

  async function submitTable(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!tableName.trim()) return fail('Name your table.', 'table');
    await run(async () => {
      await createHostTable(profile, tableName);
      router.replace('/');
    });
  }

  return {
    step, role, invited, progress: progressOf(step, role, presetRole !== null), profile, venmoInput, phoneInput, setName, setVenmo, setPhone: (raw: string) => setPhone(formatPhone(raw)), tableName, setTableName,
    choose, goTo, submitProfile, submitTable, submitting, error, errorField,
  };
}

export type WelcomeFlow = ReturnType<typeof useWelcome>;

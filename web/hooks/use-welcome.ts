'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import type { Role } from '@/components/auth/role-picker';
import { createClient } from '@/lib/supabase/client';
import { createBarWith, type BarFields } from '@/lib/supabase/pending-bar';

const EMPTY_BAR: BarFields = { barName: '', venmo: '', cashapp: '' };

/** The host-or-player choice for a signed-in account with neither: a host names a table, a player enters a code. */
export function useWelcome() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [bar, setBar] = useState<BarFields>(EMPTY_BAR);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof BarFields>(key: K, value: BarFields[K]): void {
    setBar((prev) => ({ ...prev, [key]: value }));
  }

  function choose(next: Role): void {
    setError('');
    if (next === 'member') return router.replace('/join');
    setRole(next);
  }

  // Stays `submitting` on success so the button holds still while the route changes.
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!bar.barName.trim()) return setError('Name your table.');
    setSubmitting(true);
    setError('');
    try {
      await createBarWith(createClient(), bar);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return { role, bar, setField, choose, submit, submitting, error };
}

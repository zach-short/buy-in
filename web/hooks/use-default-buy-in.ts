'use client';

import { useState } from 'react';
import useSWR from 'swr';

import { centsToDollars, toCents } from '@pb/core';
import { fetchBarSettings, updateDefaultBuyInCents } from '@/lib/supabase/bar-settings';

export interface DefaultBuyInState {
  /** Dollars as the host would type them — `20`, not `20.00`. */
  value: string;
  setValue: (value: string) => void;
  isLoading: boolean;
  error: Error | undefined;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Blank and negative are refused, not read as 0: session/new's `parseFloat(...) || 0`
// makes a blank buy-in write no row, so a saved default of 0 has to be one the host typed.
function parseCents(input: string): number | null {
  const dollars = parseFloat(input);
  return Number.isFinite(dollars) && dollars >= 0 ? toCents(dollars) : null;
}

// Same shape as useVenmoNoteTemplate, on the same SWR entry: `draft` is null until the host
// types, so the field shows the saved amount without an effect copying it into state.
// session/new reads this too and never calls save — its edits are that one session's.
export function useDefaultBuyIn(): DefaultBuyInState {
  const { data, error, isLoading, mutate } = useSWR('bar_settings', fetchBarSettings);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const value = draft ?? (data ? String(centsToDollars(data.defaultBuyInCents)) : '');

  async function save(): Promise<void> {
    if (!data) return;
    const cents = parseCents(value);
    if (cents === null) throw new Error('Enter a default buy-in of $0 or more');
    setSaving(true);
    try {
      await updateDefaultBuyInCents(data.barId, cents);
      await mutate();
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  const dirty = draft !== null && parseCents(draft) !== data?.defaultBuyInCents;
  return { value, setValue: setDraft, isLoading, error, dirty, saving, save };
}

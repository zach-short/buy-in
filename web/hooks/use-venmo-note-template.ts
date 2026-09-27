'use client';

import { useState } from 'react';
import useSWR from 'swr';

import { fetchBarSettings, updateVenmoNoteTemplate } from '@/lib/supabase/bar-settings';

export interface VenmoNoteTemplateState {
  value: string;
  setValue: (value: string) => void;
  isLoading: boolean;
  error: Error | undefined;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// The saved template comes from SWR; `draft` is null until the host types, so the field
// shows the saved value without an effect copying it into state on every load.
export function useVenmoNoteTemplate(): VenmoNoteTemplateState {
  const { data, error, isLoading, mutate } = useSWR('bar_settings', fetchBarSettings);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = data?.venmoNoteTemplate ?? '';
  const value = draft ?? saved;

  async function save(): Promise<void> {
    if (!data) return;
    setSaving(true);
    try {
      await updateVenmoNoteTemplate(data.barId, value);
      await mutate();
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  return { value, setValue: setDraft, isLoading, error, dirty: value.trim() !== saved.trim(), saving, save };
}

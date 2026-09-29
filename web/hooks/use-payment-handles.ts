'use client';

import { useState } from 'react';
import useSWR from 'swr';

import {
  fetchPaymentHandles,
  normalizeCashapp,
  normalizeVenmo,
  updatePaymentHandles,
  validateHandles,
} from '@/lib/supabase/payment-handles';

export interface PaymentHandlesState {
  venmo: string;
  cashapp: string;
  setVenmo: (value: string) => void;
  setCashapp: (value: string) => void;
  isLoading: boolean;
  error: Error | undefined;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Drafts are null until the host types, so the fields show the saved values without an
// effect copying them into state (same shape as useVenmoNoteTemplate).
export function usePaymentHandles(): PaymentHandlesState {
  const { data, error, isLoading, mutate } = useSWR('payment_handles', fetchPaymentHandles);
  const [venmoDraft, setVenmo] = useState<string | null>(null);
  const [cashappDraft, setCashapp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const venmo = venmoDraft ?? data?.venmo ?? '';
  const cashapp = cashappDraft ?? data?.cashapp ?? '';
  const dirty = normalizeVenmo(venmo) !== (data?.venmo ?? '') || normalizeCashapp(cashapp) !== (data?.cashapp ?? '');

  async function save(): Promise<void> {
    if (!data) return;
    const v = normalizeVenmo(venmo);
    const c = normalizeCashapp(cashapp);
    const problem = validateHandles(v, c);
    if (problem) throw new Error(problem);
    setSaving(true);
    try {
      await updatePaymentHandles(data.barId, v, c);
      await mutate();
      setVenmo(null);
      setCashapp(null);
    } finally {
      setSaving(false);
    }
  }

  return { venmo, cashapp, setVenmo, setCashapp, isLoading, error, dirty, saving, save };
}

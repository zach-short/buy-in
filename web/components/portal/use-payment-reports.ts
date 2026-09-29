'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';

import { myPaymentReports, reportPayment, type PaymentReport } from '@/lib/supabase/payment-reports';

export interface PaymentReportsApi {
  /** The player's recent reports; undefined while loading or when the read failed. */
  reports: PaymentReport[] | undefined;
  sending: boolean;
  /** The last failed send's message, e.g. "Needs database update 0013", shown by the form. */
  sendError: string | null;
  /** Resolves true when the report was stored. */
  send: (amountCents: number, note: string) => Promise<boolean>;
}

// Everything here is 0013's (unapplied). The read fails silently — the page hides the
// section — so a portal on today's schema still shows its balance and history. Only the
// player's own tap on "Report" can surface "Needs database update 0013".
export function usePaymentReports(token: string): PaymentReportsApi {
  const { data, error, mutate } = useSWR(['payment_reports', token], ([, t]) => myPaymentReports(t), {
    shouldRetryOnError: false,
  });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function send(amountCents: number, note: string): Promise<boolean> {
    setSending(true);
    setSendError(null);
    try {
      await reportPayment(token, amountCents, note.trim() || undefined);
      toast.success('Sent to your host to confirm');
      await mutate();
      return true;
    } catch (e) {
      setSendError((e as Error).message);
      return false;
    } finally {
      setSending(false);
    }
  }

  return { reports: error ? undefined : data, sending, sendError, send };
}

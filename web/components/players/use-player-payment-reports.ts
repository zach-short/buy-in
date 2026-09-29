import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';

import {
  confirmPaymentReport, dismissPaymentReport, listPendingPaymentReports, type PendingPaymentReport,
} from '@/lib/supabase/payment-reports';

export interface PlayerPaymentReportsApi {
  /** Pending reports, oldest first; empty while loading. */
  reports: PendingPaymentReport[];
  /** True when 0013 is not applied here: the section is not shown at all. */
  unavailable: boolean;
  /** Any other failed read, shown in place of the list. */
  loadError: string | null;
  busyId: string | null;
  /** `amountCents` overrides the reported amount; omit it to take the report as sent. */
  confirm: (report: PendingPaymentReport, amountCents?: number) => Promise<void>;
  dismiss: (report: PendingPaymentReport) => Promise<void>;
}

// Every call here is 0013's (unapplied until the owner applies it). payment-reports.ts turns a
// missing table or function into this message, and a page on today's schema must look exactly
// as it did before the section existed.
function needsMigration(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('Needs database update');
}

/** One player's pending "I sent $X" reports; `onLedgerChanged` refetches payments after a confirm. */
export function usePlayerPaymentReports(playerId: string, onLedgerChanged: () => void): PlayerPaymentReportsApi {
  const { data = [], error, mutate } = useSWR(
    ['payment_reports_pending', playerId],
    ([, id]) => listPendingPaymentReports(id),
    { shouldRetryOnError: false },
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, write: () => Promise<unknown>, done: string, movesBalance: boolean) {
    setBusyId(id);
    try {
      await write();
      toast.success(done);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      // Refetch either way: a report another host already decided drops out of the list, and a
      // confirm whose answer was lost in transit may still have written its payment.
      if (movesBalance) onLedgerChanged();
      await mutate();
      setBusyId(null);
    }
  }

  return {
    reports: error ? [] : data,
    unavailable: needsMigration(error),
    loadError: error && !needsMigration(error) ? (error as Error).message : null,
    busyId,
    confirm: (report, amountCents) =>
      run(report.id, () => confirmPaymentReport(report.id, amountCents), 'Payment confirmed', true),
    dismiss: (report) => run(report.id, () => dismissPaymentReport(report.id), 'Report dismissed', false),
  };
}

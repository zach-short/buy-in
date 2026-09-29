import { useState } from 'react';
import { formatCents, formatDate } from '@pb/core';
import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MoneyInput, parseMoneyInput } from '@/components/ui/money-input';
import type { PendingPaymentReport } from '@/lib/supabase/payment-reports';
import { usePlayerPaymentReports, type PlayerPaymentReportsApi } from '@/components/players/use-player-payment-reports';

const ACTION = 'flex-1 h-11 text-xs tracking-widest uppercase';

// Confirm writes the payment the player reported. When the Venmo that actually arrived differs,
// the host fixes the amount first; the override is sent only when it differs from the report.
function ReportRow({ report, api }: { report: PendingPaymentReport; api: PlayerPaymentReportsApi }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(formatCents(report.amountCents));
  const overrideCents = parseMoneyInput(amount);
  const busy = api.busyId !== null;
  const canConfirm = !editing || (overrideCents !== null && overrideCents > 0);

  function confirm() {
    if (!editing || overrideCents === null || overrideCents === report.amountCents) return api.confirm(report);
    return api.confirm(report, overrideCents);
  }

  return (
    <div className='border border-border rounded-md p-4 space-y-3'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='text-sm'>Says they sent ${formatCents(report.amountCents)}</p>
          {report.note && <p className='text-xs text-muted-foreground break-words'>{report.note}</p>}
          <p className='text-xs text-muted-foreground'>{formatDate(report.createdAt)}</p>
        </div>
        {!editing && (
          <button
            type='button'
            onClick={() => setEditing(true)}
            disabled={busy}
            className='h-11 shrink-0 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground disabled:opacity-50'
          >
            Edit amount
          </button>
        )}
      </div>
      {editing && (
        <MoneyInput value={amount} onValueChange={setAmount} aria-label='Amount received' disabled={busy} />
      )}
      <div className='flex gap-2'>
        <Button variant='outline' className={ACTION} disabled={busy} onClick={() => void api.dismiss(report)}>
          <X aria-hidden='true' />
          Dismiss
        </Button>
        <Button className={ACTION} disabled={busy || !canConfirm} onClick={() => void confirm()}>
          <Check aria-hidden='true' />
          {api.busyId === report.id ? 'Saving…' : 'Confirm'}
        </Button>
      </div>
    </div>
  );
}

/**
 * The player's "I sent $X" reports from their portal (0013) waiting on the host. Absent entirely
 * until 0013 is applied, and when there is nothing pending.
 */
export function ReportedPayments({ playerId, onLedgerChanged }: { playerId: string; onLedgerChanged: () => void }) {
  const api = usePlayerPaymentReports(playerId, onLedgerChanged);
  if (api.unavailable) return null;
  if (!api.loadError && !api.reports.length) return null;
  return (
    <div className='space-y-3 mb-8'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>Reported payments</p>
      {api.loadError && <p className='text-xs text-destructive'>{api.loadError}</p>}
      {api.reports.map((r) => <ReportRow key={r.id} report={r} api={api} />)}
    </div>
  );
}

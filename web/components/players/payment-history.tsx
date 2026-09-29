import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCents, formatDate } from '@pb/core';

import { useConfirm } from '@/hooks/use-confirm';
import { deletePayment } from '@/lib/supabase/payment-edits';
import type { PaymentRow } from '@/lib/supabase/queries';

function describePayment(p: PaymentRow): string {
  return p.direction === 'received' ? 'Paid you' : 'You paid them';
}

/** Every payment with this player, newest first, each deletable to correct a mistyped amount. */
export function PaymentHistory({ payments, onChanged }: {
  payments: PaymentRow[];
  onChanged: () => void;
}) {
  const { confirm, confirmDialog } = useConfirm();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function remove(p: PaymentRow) {
    const amount = `$${formatCents(p.amount_cents)}`;
    const ok = await confirm({
      title: `Delete this ${amount} payment?`,
      description: `${describePayment(p)} ${amount} on ${formatDate(p.created_at)}. Their balance goes back to what it was without it.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(p.id);
    try {
      await deletePayment(p.id);
      toast.success('Payment deleted');
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  if (!payments.length) return null;
  return (
    <div className='space-y-2'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>
        Payment History
      </p>
      {payments.map((p) => (
        <div
          key={p.id}
          className='flex items-center justify-between gap-2 py-2.5 border-b border-border last:border-0'
        >
          <div className='min-w-0'>
            <p className='text-sm'>{describePayment(p)}</p>
            {p.note && (
              <p className='text-xs text-muted-foreground break-words'>{p.note}</p>
            )}
            <p className='text-xs text-muted-foreground'>
              {formatDate(p.created_at)}
            </p>
          </div>
          <div className='flex items-center gap-1 shrink-0'>
            <span
              className={`text-sm font-semibold tabular-nums ${p.direction === 'received' ? 'text-green-500' : 'text-destructive'}`}
            >
              {p.direction === 'received' ? '−' : '+'}${formatCents(p.amount_cents)}
            </span>
            <button
              type='button'
              aria-label={`Delete ${describePayment(p).toLowerCase()} $${formatCents(p.amount_cents)} on ${formatDate(p.created_at)}`}
              disabled={deletingId !== null}
              onClick={() => void remove(p)}
              className='size-11 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50'
            >
              <Trash2 className='size-4' aria-hidden />
            </button>
          </div>
        </div>
      ))}
      {confirmDialog}
    </div>
  );
}

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { formatCents } from '@pb/core';
import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput, parseMoneyInput } from '@/components/ui/money-input';
import type { PlayerRow } from '@/lib/supabase/queries';
import { createPayment } from '@/lib/supabase/writes';

export type PaymentMode = 'received' | 'sent';

const CHIP = 'h-11 min-w-11 rounded-full border border-border px-4 text-xs tracking-widest uppercase text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50';

/**
 * What is owed in this form's direction, in cents: the player's debt when they are paying the
 * house, the house's debt when the host is paying them, otherwise nothing.
 */
function amountDueCents(mode: PaymentMode, balanceCents: number): number {
  return Math.max(0, mode === 'received' ? balanceCents : -balanceCents);
}

/** Records one payment against the player's whole balance (no session), as it always has. */
export function RecordPaymentForm({ player, mode, balanceCents, onRecorded, onClose }: {
  player: Pick<PlayerRow, 'id' | 'bar_id'>;
  mode: PaymentMode;
  balanceCents: number;
  onRecorded: () => void;
  onClose: () => void;
}) {
  const dueCents = amountDueCents(mode, balanceCents);
  // Half rounds down, so it never asks for more than was owed.
  const halfCents = Math.floor(dueCents / 2);
  const [amount, setAmount] = useState(dueCents > 0 ? formatCents(dueCents) : '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const amountCents = parseMoneyInput(amount);
  const valid = amountCents !== null && amountCents > 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await createPayment(player, amountCents, note.trim(), mode);
      toast.success(mode === 'received' ? 'Payment recorded' : 'Payout recorded');
      onRecorded();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className='border border-border rounded-md p-4 mb-8 space-y-3'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>
        {mode === 'received' ? 'Record Payment Received' : 'Record Payout Sent'}
      </p>
      <MoneyInput
        value={amount}
        onValueChange={setAmount}
        onKeyDown={blockEnter}
        enterKeyHint='next'
        autoFocus
        placeholder='0.00'
        aria-label='Amount'
        disabled={saving}
      />
      {dueCents > 0 && (
        <div className='flex flex-wrap gap-2'>
          <button type='button' className={CHIP} disabled={saving} onClick={() => setAmount(formatCents(dueCents))}>
            Full ${formatCents(dueCents)}
          </button>
          {halfCents > 0 && (
            <button type='button' className={CHIP} disabled={saving} onClick={() => setAmount(formatCents(halfCents))}>
              Half ${formatCents(halfCents)}
            </button>
          )}
        </div>
      )}
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={blockEnter}
        enterKeyHint='done'
        className='h-11'
        placeholder='Note (optional)'
        aria-label='Note'
      />
      <div className='flex gap-2'>
        <Button
          type='button'
          variant='outline'
          className='flex-1 h-11 text-xs tracking-widest uppercase'
          onClick={onClose}
          disabled={saving}
        >
          <X aria-hidden='true' />
          Cancel
        </Button>
        <Button
          type='submit'
          className='flex-1 h-11 text-xs tracking-widest uppercase'
          disabled={saving || !valid}
        >
          <Check aria-hidden='true' />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

// The amount is pre-filled with the full debt and focused, so an Enter from the keyboard would
// write a payment nobody confirmed. Only the Save button records one.
function blockEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.preventDefault();
}

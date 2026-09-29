'use client';

import { useState } from 'react';

import { formatCents, formatDate } from '@pb/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput, parseMoneyInput } from '@/components/ui/money-input';
import {
  PAYMENT_REPORT_MAX_CENTS, PAYMENT_REPORT_NOTE_MAX_LENGTH, type PaymentReport, type PaymentReportStatus,
} from '@/lib/supabase/payment-reports';

import type { PaymentReportsApi } from './use-payment-reports';

// "I sent $X" (0013). A report moves no money: it waits for the host, who confirms it (that
// writes the real payment) or dismisses it. The copy says so, so a player does not read a
// sent report as a paid-down balance.

function amountProblem(cents: number | null): string | null {
  if (cents === null || cents <= 0) return 'Enter the amount you sent';
  if (cents > PAYMENT_REPORT_MAX_CENTS) return `Reports are capped at $${formatCents(PAYMENT_REPORT_MAX_CENTS)}`;
  return null;
}

interface ReportFormProps {
  defaultCents: number;
  api: PaymentReportsApi;
  onClose: () => void;
}

export function ReportPaymentForm({ defaultCents, api, onClose }: ReportFormProps) {
  const [amount, setAmount] = useState(() => formatCents(defaultCents));
  const [note, setNote] = useState('');
  const cents = parseMoneyInput(amount);
  const problem = amountProblem(cents);

  async function submit() {
    if (cents === null || problem) return;
    if (await api.send(cents, note)) onClose();
  }

  return (
    <form
      className='mx-6 mb-8 border border-border rounded-md p-4 space-y-3'
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className='text-sm font-medium'>Tell your host you paid</p>
      <p className='text-xs text-muted-foreground'>Your balance changes once your host confirms it.</p>
      <MoneyInput value={amount} onValueChange={setAmount} aria-label='Amount you sent' aria-invalid={problem !== null} />
      {problem && <p className='text-xs text-destructive'>{problem}</p>}
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={PAYMENT_REPORT_NOTE_MAX_LENGTH}
        placeholder='Note (optional)'
        aria-label='Note'
      />
      {api.sendError && <p className='text-xs text-destructive' role='alert'>{api.sendError}</p>}
      <div className='flex gap-2'>
        <Button type='button' variant='outline' className='flex-1 text-xs tracking-widest uppercase' onClick={onClose}>
          Cancel
        </Button>
        <Button type='submit' className='flex-1 text-xs tracking-widest uppercase' disabled={problem !== null || api.sending}>
          {api.sending ? 'Sending…' : `I sent $${cents === null ? '0.00' : formatCents(cents)}`}
        </Button>
      </div>
    </form>
  );
}

const STATUS_LABEL: Readonly<Record<PaymentReportStatus, string>> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  dismissed: 'Dismissed',
};

const STATUS_CLASS: Readonly<Record<PaymentReportStatus, string>> = {
  pending: 'text-muted-foreground',
  confirmed: 'text-green-500',
  dismissed: 'text-destructive',
};

export function PaymentReportList({ reports }: { reports: PaymentReport[] }) {
  if (!reports.length) return null;
  return (
    <section className='mx-6 mb-8'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>Payments you reported</p>
      <div className='space-y-2'>
        {reports.map((r) => (
          <div key={r.id} className='border border-border rounded-md px-4 py-3 flex items-baseline justify-between gap-3'>
            <span className='min-w-0'>
              <span className='block text-sm tabular-nums'>${formatCents(r.amountCents)}</span>
              <span className='block text-xs text-muted-foreground truncate'>
                {formatDate(r.createdAt)}{r.note ? ` · ${r.note}` : ''}
              </span>
            </span>
            <span className={`text-xs tracking-widest uppercase shrink-0 ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';

import { formatCents, renderVenmoNote, venmoUrls, type SharedTab } from '@pb/core';
import { MoneyInput, parseMoneyInput } from '@/components/ui/money-input';
import { openVenmo } from '@/lib/venmo';

// Pay the host some or all of what is owed. The field defaults to the whole balance; a
// partial payment is the player's choice, but never more than the balance — an overpayment
// would turn into money the host owes back, which is not something a pay button should do.

const PAY_BUTTON = 'w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-bold disabled:opacity-50';
// White on Venmo blue passes; white on Cash App green is about 1.9:1, so that one takes dark text.
const VENMO_BUTTON = `${PAY_BUTTON} text-white`;
const CASHAPP_BUTTON = `${PAY_BUTTON} text-black`;

/** What a player who owes sees when the host has set up neither Venmo nor Cash App. */
export const NO_PAY_METHOD = 'Your host has not added a payment method. Ask them how to pay.';

// The documented form is `cash.app/$cashtag/<amount>`. Cash App's own docs now steer people to
// in-app "share link" requests and say little about the amount segment; the cashtag page still
// opens without it, so the worst case is the player types the amount in Cash App.
function cashAppUrl(handle: string, amountCents: number): string {
  const name = handle.trim().replace(/^\$+/, '');
  return `https://cash.app/$${encodeURIComponent(name)}/${formatCents(amountCents)}`;
}

function amountProblem(cents: number | null, balanceCents: number): string | null {
  if (cents === null || cents <= 0) return 'Enter an amount';
  if (cents > balanceCents) return `That's more than you owe ($${formatCents(balanceCents)})`;
  return null;
}

interface PayPanelProps {
  bar: SharedTab['bar'];
  balanceCents: number;
  /** Called with the amount as the player leaves for Venmo or Cash App, to offer the report. */
  onPay: (amountCents: number) => void;
}

export function PayPanel({ bar, balanceCents, onPay }: PayPanelProps) {
  const [amount, setAmount] = useState(() => formatCents(balanceCents));
  const cents = parseMoneyInput(amount);
  const problem = amountProblem(cents, balanceCents);
  const payCents = problem ? null : cents;
  const { venmo_handle: venmo, cashapp_handle: cashapp } = bar;
  if (!venmo && !cashapp) return <p className='mt-5 text-xs text-muted-foreground'>{NO_PAY_METHOD}</p>;

  function payVenmo(handle: string, amountCents: number) {
    // The host's template (0003, owner 2026-09-27), rendered for the amount actually sent.
    const note = renderVenmoNote(bar.venmo_note_template, { amountCents });
    onPay(amountCents);
    openVenmo(venmoUrls(handle, amountCents, note));
  }

  return (
    <div className='mt-5 space-y-3 text-left'>
      <label htmlFor='portal-pay-amount' className='block text-xs tracking-widest uppercase text-muted-foreground'>
        Amount to pay
      </label>
      <MoneyInput id='portal-pay-amount' value={amount} onValueChange={setAmount} aria-invalid={problem !== null} />
      {problem && <p className='text-xs text-destructive'>{problem}</p>}
      {venmo && (
        <button
          type='button'
          disabled={payCents === null}
          onClick={() => payCents !== null && payVenmo(venmo, payCents)}
          className={VENMO_BUTTON}
          style={{ background: '#3D95CE' }}
        >
          <svg width='16' height='16' viewBox='0 0 24 24' fill='white' aria-hidden='true'>
            <path d='M19.07 3C19.82 4.27 20.16 5.58 20.16 7.22C20.16 12.23 15.68 18.72 12.05 22H4.27L1 4.36L8.19 3.67L9.84 15.05C11.42 12.36 13.38 8.19 13.38 5.42C13.38 3.97 13.1 2.97 12.68 2.14L19.07 3Z' />
          </svg>
          {payCents === null ? 'Pay on Venmo' : `Pay $${formatCents(payCents)} on Venmo`}
        </button>
      )}
      {cashapp && (
        payCents === null ? (
          <button type='button' disabled className={CASHAPP_BUTTON} style={{ background: '#00D64F' }}>Pay on Cash App</button>
        ) : (
          // A new tab, so this page — and the report form it opens — is still here on return.
          <a
            href={cashAppUrl(cashapp, payCents)}
            target='_blank'
            rel='noopener noreferrer'
            onClick={() => onPay(payCents)}
            className={CASHAPP_BUTTON}
            style={{ background: '#00D64F' }}
          >
            Pay ${formatCents(payCents)} on Cash App
          </a>
        )
      )}
    </div>
  );
}

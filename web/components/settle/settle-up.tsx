'use client';

import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';

import { DEFAULT_VENMO_NOTE, describeNet, formatCents, venmoUrls, type NetDisplay, type NightNet } from '@pb/core';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput, parseMoneyInput } from '@/components/ui/money-input';
import { useConfirm, type ConfirmApi } from '@/hooks/use-confirm';
import { nightNetFromRows } from '@/lib/ledger';
import type { BuyInRow, CashoutRow, OrderRow, PaymentRow, PlayerRow } from '@/lib/supabase/queries';
import { createPayment } from '@/lib/supabase/writes';
import { openVenmo } from '@/lib/venmo';

import { netText, paidLine } from './net-copy';
import { sendReceipt } from './send-receipt';

// One row per player of the night: what the night comes to, and the three ways to close it —
// record a payment, hand off to Venmo, text the receipt. Deliberately one list, not a ledger:
// the player's page is where history and one-off payments live. Every payment recorded here
// carries this session's id, so the receipt texted for the night shows it (get_shared_tab).
// `orders.paid` (Mark Paid on the session screen) is a display flag and is not read here.

type Confirm = ConfirmApi['confirm'];

interface SettleUpProps {
  sessionId: string;
  players: readonly PlayerRow[];
  /** This night's rows only — payments already filtered to this session's id. */
  orders: readonly OrderRow[];
  buyIns: readonly BuyInRow[];
  cashouts: readonly CashoutRow[];
  payments: readonly PaymentRow[];
}

const ACTION_CLASS =
  'h-9 px-3 rounded border border-border text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50';

const STATUS_CLASS = {
  owes: 'text-destructive',
  owed: 'text-green-500',
  even: 'text-muted-foreground',
} as const;

export function SettleUp({ sessionId, players, orders, buyIns, cashouts, payments }: SettleUpProps) {
  const { confirm, confirmDialog } = useConfirm();
  const { mutate } = useSWRConfig();

  // 'payments' is the bar-wide list this page reads; ['payments', id] is the player page's.
  async function refresh(playerId: string) {
    await Promise.all([mutate('payments'), mutate(['payments', playerId])]);
  }

  return (
    <section className='border border-border rounded-md mb-6'>
      <p className='px-4 pt-4 pb-2 text-xs tracking-widest uppercase text-muted-foreground'>Settle up</p>
      <ul className='divide-y divide-border'>
        {players.map((player) => (
          <SettleRow
            key={player.id}
            player={player}
            sessionId={sessionId}
            night={nightNetFromRows(player.id, orders, buyIns, cashouts, payments)}
            hasPayments={payments.some((p) => p.player_id === player.id)}
            confirm={confirm}
            onRecorded={() => refresh(player.id)}
          />
        ))}
      </ul>
      {confirmDialog}
    </section>
  );
}

interface SettleRowProps {
  player: PlayerRow;
  sessionId: string;
  night: NightNet;
  hasPayments: boolean;
  confirm: Confirm;
  onRecorded: () => Promise<void>;
}

function SettleRow({ player, sessionId, night, hasPayments, confirm, onRecorded }: SettleRowProps) {
  const [recording, setRecording] = useState(false);
  const net = describeNet(night.netCents);
  const handle = player.venmo;

  return (
    <li className='px-4 py-3 space-y-2'>
      <div className='flex items-baseline justify-between gap-3'>
        <span className='text-sm font-medium truncate'>{player.name}</span>
        <span className={`text-sm font-semibold tabular-nums shrink-0 ${STATUS_CLASS[net.kind]}`}>
          {netText(night.netCents, 'host')}
        </span>
      </div>
      <p className='text-xs text-muted-foreground tabular-nums'>{breakdown(night, hasPayments)}</p>
      <div className='flex flex-wrap gap-2'>
        {net.kind !== 'even' && (
          <button type='button' className={ACTION_CLASS} onClick={() => setRecording((open) => !open)}>
            Record payment
          </button>
        )}
        {net.kind !== 'even' && handle && (
          <button type='button' className={ACTION_CLASS} onClick={() => openVenmo(venmoFor(handle, net))}>
            {net.kind === 'owes' ? 'Venmo request' : 'Venmo pay'}
          </button>
        )}
        <button type='button' className={ACTION_CLASS} onClick={() => void sendReceipt(player, sessionId)}>
          {player.phone ? 'Text receipt' : 'Share receipt'}
        </button>
      </div>
      {recording && net.kind !== 'even' && (
        <RecordPaymentForm
          player={player}
          sessionId={sessionId}
          net={net}
          confirm={confirm}
          onDone={async (saved) => {
            // The payment is written; a failed refetch must not read as a failed save.
            if (saved) await onRecorded().catch(() => undefined);
            setRecording(false);
          }}
        />
      )}
    </li>
  );
}

/** `Drinks $8.00 · Buy-ins $20.00 · Cash-out $16.00 · Paid $5.00` — the parts the net adds up from. */
function breakdown(night: NightNet, hasPayments: boolean): string {
  const parts = [
    `Drinks $${formatCents(night.drinksCents)}`,
    `Buy-ins $${formatCents(night.buyInsCents)}`,
    `Cash-out $${formatCents(night.cashoutsCents)}`,
  ];
  if (hasPayments) {
    const paid = paidLine(night.paidCents, 'host');
    parts.push(`${paid.label} ${paid.amount}`);
  }
  return parts.join(' · ');
}

// The host asks a player who owes (charge) and pays a player who is owed, on the player's own
// handle, with the plain default note — as the player page does. The host's template is
// worded for players paying the house, and says nothing of this night's net.
function venmoFor(handle: string, net: NetDisplay) {
  return venmoUrls(handle, net.amountCents, DEFAULT_VENMO_NOTE, net.kind === 'owes' ? 'charge' : 'pay');
}

interface RecordPaymentFormProps {
  player: PlayerRow;
  sessionId: string;
  /** Never `even`: there is nothing to record against a settled night. */
  net: NetDisplay;
  confirm: Confirm;
  onDone: (saved: boolean) => Promise<void>;
}

function RecordPaymentForm({ player, sessionId, net, confirm, onDone }: RecordPaymentFormProps) {
  const full = formatCents(net.amountCents);
  const [amount, setAmount] = useState(full);
  const [saving, setSaving] = useState(false);
  const owes = net.kind === 'owes';

  async function save() {
    const cents = parseMoneyInput(amount);
    if (!cents) {
      toast.error('Enter an amount');
      return;
    }
    if (cents > net.amountCents && !(await confirmOverpay(cents))) return;
    setSaving(true);
    try {
      await createPayment(player, cents, '', owes ? 'received' : 'sent', sessionId);
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
      return;
    }
    toast.success(owes ? `$${formatCents(cents)} from ${player.name} recorded` : `$${formatCents(cents)} to ${player.name} recorded`);
    // Stays disabled until the net is refetched, so the stale amount cannot be recorded twice.
    await onDone(true);
  }

  function confirmOverpay(cents: number): Promise<boolean> {
    const extra = formatCents(cents - net.amountCents);
    const owing = owes ? `${player.name} owes` : `you owe ${player.name}`;
    return confirm({
      title: `Record $${formatCents(cents)}?`,
      description: `That is $${extra} more than ${owing} for tonight. The extra carries to their balance.`,
      confirmLabel: 'Record',
    });
  }

  return (
    <div className='space-y-2 pt-1'>
      <p className='text-xs text-muted-foreground'>{owes ? `${player.name} paid you` : `You paid ${player.name}`}</p>
      <MoneyInput value={amount} onValueChange={setAmount} disabled={saving} aria-label='Payment amount' />
      <div className='flex flex-wrap gap-2'>
        <button type='button' className={ACTION_CLASS} disabled={saving} onClick={() => setAmount(full)}>
          Full ${full}
        </button>
        <div className='flex gap-2 ml-auto'>
          <Button variant='outline' size='sm' disabled={saving} onClick={() => void onDone(false)}>
            <X aria-hidden='true' />
            Cancel
          </Button>
          <Button size='sm' disabled={saving} onClick={() => void save()}>
            <Check aria-hidden='true' />
            {saving ? 'Saving…' : 'Record'}
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { formatCents } from '@pb/core';

import { MoneyInput } from '@/components/ui/money-input';
import { useDefaultBuyIn } from '@/hooks/use-default-buy-in';
import type { BuyInRow, CashoutRow, PlayerRow } from '@/lib/supabase/queries';
import { buyInLabel, MoneyEntries, type MoneyEntry } from './money-entries';
import type { usePlayerMoney } from './use-player-money';

type Mode = 'idle' | 'rebuy' | 'cashout';

interface PlayerMoneyPanelProps {
  player: Pick<PlayerRow, 'id' | 'name'>;
  /** This player's rows only. */
  buyIns: readonly BuyInRow[];
  cashout: CashoutRow | undefined;
  money: ReturnType<typeof usePlayerMoney>;
}

const LINK = 'h-11 px-2 text-xs tracking-widest uppercase text-muted-foreground transition-colors';

function entriesFor({ player, buyIns, cashout, money }: PlayerMoneyPanelProps): MoneyEntry[] {
  const rows: MoneyEntry[] = buyIns.map((row, i) => ({
    id: row.id, label: buyInLabel(i), cents: row.amount_cents, createdAt: row.created_at,
    onSave: (value) => money.editBuyIn(row, player, buyInLabel(i), value),
    onDelete: () => money.removeBuyIn(row, player, buyInLabel(i)),
  }));
  if (cashout) {
    rows.push({
      id: cashout.id, label: cashout.amount_cents === 0 ? 'Cash-out (busted)' : 'Cash-out', cents: cashout.amount_cents,
      createdAt: cashout.created_at,
      onSave: (value) => money.editCashout(cashout, player, value),
      onDelete: () => money.removeCashout(cashout, player),
    });
  }
  return rows;
}

// Keyed by player in the page, so an open re-buy form never carries over to the next player.
export function PlayerMoneyPanel(props: PlayerMoneyPanelProps) {
  const { player, buyIns, cashout, money } = props;
  const { value: defaultBuyIn } = useDefaultBuyIn();
  const [mode, setMode] = useState<Mode>('idle');
  // null until the host types: a re-buy starts at the bar's default, which may still be
  // loading when the form opens, so it is derived live rather than copied in once.
  const [draft, setDraft] = useState<string | null>(null);
  const amount = draft ?? (mode === 'rebuy' ? defaultBuyIn : '');
  const [busy, setBusy] = useState(false);
  const totalCents = buyIns.reduce((sum, b) => sum + b.amount_cents, 0);

  function open(next: Mode) {
    setMode(next);
    setDraft(null);
  }

  async function submit(value = amount) {
    setBusy(true);
    const saved = mode === 'rebuy' ? await money.rebuy(player, value) : await money.cashOutEarly(player, value);
    setBusy(false);
    if (saved) setMode('idle');
  }

  return (
    <div className='px-6 py-3 border-b border-border space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='text-xs text-muted-foreground'>
          Buy-ins: <span className='text-foreground font-medium'>${formatCents(totalCents)}</span>
          {cashout && (
            <span className='ml-2 text-green-500 font-medium'>
              · {cashout.amount_cents === 0 ? 'Out — busted' : `Cashed out $${formatCents(cashout.amount_cents)}`}
            </span>
          )}
        </div>
        {mode === 'idle' && (
          <div className='flex gap-1'>
            {!cashout && <button type='button' onClick={() => open('cashout')} className={`${LINK} hover:text-green-500`}>Cash Out</button>}
            <button type='button' onClick={() => open('rebuy')} className={`${LINK} hover:text-primary`}>+ Re-buy</button>
          </div>
        )}
      </div>

      {mode !== 'idle' && (
        <div className='flex flex-wrap items-start gap-2'>
          <MoneyInput
            autoFocus
            aria-label={mode === 'rebuy' ? `Re-buy for ${player.name}` : `Cash-out for ${player.name}`}
            placeholder={mode === 'rebuy' ? 'Amount' : 'Chip value'}
            value={amount}
            onValueChange={setDraft}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            quickAmounts={mode === 'rebuy' ? [10, 20] : undefined}
            containerClassName='w-40'
            disabled={busy}
          />
          {mode === 'cashout' && (
            <button type='button' onClick={() => submit('0')} disabled={busy} className={`${LINK} border border-border rounded-md`}>
              Busted — $0
            </button>
          )}
          <button type='button' onClick={() => submit()} disabled={busy} className={`${LINK} text-primary disabled:opacity-40`}>
            {mode === 'rebuy' ? 'Add' : 'Confirm'}
          </button>
          <button type='button' onClick={() => setMode('idle')} disabled={busy} className={LINK}>Cancel</button>
        </div>
      )}

      <MoneyEntries entries={entriesFor(props)} />
    </div>
  );
}

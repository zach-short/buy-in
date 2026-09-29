'use client';

import { formatCents } from '@pb/core';

import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { cn } from '@/lib/utils';
import { PotDecision } from './pot-decision';
import type { useCloseSession } from './use-close-session';

interface CashOutScreenProps {
  close: ReturnType<typeof useCloseSession>;
  buyInCents: (playerId: string) => number;
  tabCents: (playerId: string) => number;
  onBack: () => void;
}

export function CashOutScreen({ close, buyInCents, tabCents, onBack }: CashOutScreenProps) {
  const { entries, remainingCents, totalInCents, outCents, missing, closing } = close;
  const isOver = remainingCents < 0;

  return (
    <PageMain className='flex flex-col'>
      <PageHeader title='Cash Out' subtitle='Enter each player&apos;s chip value to close the session.' />

      <div className='border border-border rounded-md px-5 py-4 mb-6 flex items-center justify-between'>
        <div>
          <p className='text-xs tracking-widest uppercase text-muted-foreground'>Pot remaining</p>
          <p className={cn('text-2xl font-bold mt-0.5 tabular-nums', isOver ? 'text-destructive' : remainingCents === 0 ? 'text-green-500' : 'text-foreground')}>
            ${formatCents(Math.abs(remainingCents))}
            {isOver && <span className='text-xs font-normal ml-1 text-destructive'>over</span>}
          </p>
        </div>
        <div className='text-right text-xs text-muted-foreground space-y-0.5'>
          <p>${formatCents(totalInCents)} total buy-ins</p>
          <p>−${formatCents(outCents)} cashed out</p>
        </div>
      </div>

      {missing.length > 0 && (
        <p className='text-xs text-muted-foreground mb-4'>
          Still to enter: <span className='text-foreground'>{missing.join(', ')}</span>. Blank is not $0 — tap Busted for anyone who lost it all.
        </p>
      )}
      {missing.length === 0 && remainingCents !== 0 && (
        <PotDecision
          entries={entries}
          remainingCents={remainingCents}
          houseAckCents={close.houseAckCents}
          onAssign={close.assignRemainder}
          onHouse={close.setHouseAckCents}
        />
      )}
      {close.failures.length > 0 && (
        <div role='alert' className='border border-destructive/60 rounded-md px-4 py-3 mb-6 text-xs space-y-1'>
          <p className='text-destructive tracking-widest uppercase'>Not saved — session still open</p>
          {close.failures.map((f) => <p key={f}>{f}</p>)}
        </div>
      )}

      <div className='space-y-4 flex-1'>
        {entries.map(({ playerId, name, cents }) => {
          const drinksCents = tabCents(playerId);
          return (
            <div key={playerId} className='border border-border rounded-md px-4 py-4'>
              <div className='flex items-center justify-between mb-3'>
                <span className='text-sm font-medium'>{name}</span>
                <div className='text-right text-xs text-muted-foreground'>
                  <span>Bought in ${formatCents(buyInCents(playerId))}</span>
                  {drinksCents > 0 && <span> · Drinks ${formatCents(drinksCents)}</span>}
                </div>
              </div>
              <div className='flex gap-2'>
                <MoneyInput
                  aria-label={`${name}'s cash-out`}
                  placeholder='Not entered'
                  value={close.amounts[playerId] ?? ''}
                  onValueChange={(v) => close.setAmount(playerId, v)}
                  containerClassName='flex-1'
                  disabled={closing}
                />
                <button
                  type='button'
                  onClick={() => close.setAmount(playerId, '0')}
                  disabled={closing}
                  aria-pressed={cents === 0}
                  className={cn(
                    'h-11 shrink-0 rounded-md border px-3 text-xs tracking-widest uppercase transition-colors disabled:opacity-40',
                    cents === 0 ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  Busted — $0
                </button>
              </div>
              <p className='text-xs text-muted-foreground mt-1'>Chip value they&apos;re walking away with</p>
            </div>
          );
        })}
      </div>

      <div className='flex gap-3 mt-8'>
        <Button variant='outline' className='flex-1 h-12 text-xs tracking-widest uppercase' onClick={onBack} disabled={closing}>
          Back
        </Button>
        <Button className='flex-1 h-12 text-xs tracking-widest uppercase' onClick={close.close} disabled={closing}>
          {closing ? 'Closing…' : 'Close Session'}
        </Button>
      </div>
    </PageMain>
  );
}

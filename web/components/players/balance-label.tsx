import { formatCents, isSettled } from '@pb/core';

// Positive means the player owes the house (web/lib/ledger.ts).

/** The big running-balance figure on a player's page. */
export function BalanceLabel({ cents }: { cents: number }) {
  if (isSettled(cents))
    return (
      <span className='text-3xl font-bold text-muted-foreground'>Even</span>
    );
  if (cents > 0)
    return (
      <div className='text-center'>
        <p className='text-3xl font-bold text-destructive'>
          ${formatCents(cents)}
        </p>
        <p className='text-xs text-muted-foreground tracking-widest uppercase mt-1'>
          They owe you
        </p>
      </div>
    );
  return (
    <div className='text-center'>
      <p className='text-3xl font-bold text-green-500'>
        ${formatCents(Math.abs(cents))}
      </p>
      <p className='text-xs text-muted-foreground tracking-widest uppercase mt-1'>
        You owe them
      </p>
    </div>
  );
}

/** One line for a balance in a sentence or a list: "owes $12.00", "is owed $5.00", "even". */
export function describeBalance(cents: number): string {
  if (isSettled(cents)) return 'even';
  return cents > 0 ? `owes $${formatCents(cents)}` : `is owed $${formatCents(-cents)}`;
}

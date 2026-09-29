import type { TypeTotal } from '@pb/core';
import { signedAmount, toneClass } from '@/components/results/poker-result-row';

const CAPTION = 'text-xs tracking-widest uppercase text-muted-foreground';

/** Net and Entries for the rows on screen, filtered or not. */
export function EverythingTotals({ totalCents, entries }: { totalCents: number; entries: number }) {
  return (
    <div className='grid grid-cols-2 gap-3 mb-6'>
      {[
        { label: 'Net', value: signedAmount(totalCents), color: toneClass(totalCents) },
        { label: 'Entries', value: String(entries), color: 'text-foreground' },
      ].map(({ label, value, color }) => (
        <div key={label} className='border border-border rounded-md p-4'>
          <p className={`${CAPTION} mb-1`}>{label}</p>
          <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Each type's net, which sum to the Net above (breakdownByType, pinned by event-result.test.ts).
 * Poker is one line for home games and logged sessions alike (BD-6).
 */
export function TypeBreakdown({ totals }: { totals: readonly TypeTotal[] }) {
  return (
    <div className='border border-border rounded-md p-5 mb-6'>
      <p className={`${CAPTION} mb-2`}>By type</p>
      <ul className='divide-y divide-border'>
        {totals.map(({ slug, label, netCents, entries }) => (
          <li key={slug} className='flex items-baseline justify-between gap-3 py-2'>
            <p className='text-sm truncate'>
              {label} <span className='text-xs text-muted-foreground tabular-nums'>· {entries}</span>
            </p>
            <p className={`text-sm font-semibold tabular-nums ${toneClass(netCents)}`}>{signedAmount(netCents)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

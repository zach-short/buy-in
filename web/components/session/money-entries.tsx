'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { centsToDollars, formatCents, formatTime } from '@pb/core';

import { MoneyInput } from '@/components/ui/money-input';

export interface MoneyEntry {
  id: string;
  label: string;
  cents: number;
  createdAt: string;
  onSave: (value: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

/** Buy-ins arrive oldest first (fetchSessionBuyIns), so the first is the buy-in and the rest are re-buys. */
export function buyInLabel(index: number): string {
  return index === 0 ? 'Buy-in' : 'Re-buy';
}

const ICON_BUTTON = 'size-11 shrink-0 flex items-center justify-center rounded text-muted-foreground transition-colors';

// One player's buy-ins and cash-out for the night, each fixable in place. The confirm for an
// edit or a delete is asked by the handler (usePlayerMoney), not here.
export function MoneyEntries({ entries }: { entries: readonly MoneyEntry[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(entry: MoneyEntry) {
    setSaving(true);
    const saved = await entry.onSave(draft);
    setSaving(false);
    if (saved) setEditingId(null);
  }

  if (entries.length === 0) return null;
  return (
    <ul className='divide-y divide-border border border-border rounded-md'>
      {entries.map((entry) => (
        <li key={entry.id} className='px-3 py-1 min-h-[52px] flex items-center gap-2'>
          {editingId === entry.id ? (
            <>
              <MoneyInput
                autoFocus
                aria-label={`New ${entry.label.toLowerCase()} amount`}
                value={draft}
                onValueChange={setDraft}
                onKeyDown={(e) => e.key === 'Enter' && save(entry)}
                containerClassName='flex-1'
                disabled={saving}
              />
              <button type='button' onClick={() => save(entry)} disabled={saving} className='h-11 px-3 text-xs tracking-widest uppercase text-primary disabled:opacity-40'>
                Save
              </button>
              <button type='button' onClick={() => setEditingId(null)} disabled={saving} className='h-11 px-3 text-xs text-muted-foreground'>
                Cancel
              </button>
            </>
          ) : (
            <>
              <div className='min-w-0 flex-1'>
                <p className='text-sm'>{entry.label}</p>
                <p className='text-xs text-muted-foreground'>{formatTime(entry.createdAt)}</p>
              </div>
              <span className='text-sm font-medium tabular-nums'>${formatCents(entry.cents)}</span>
              <button
                type='button'
                aria-label={`Edit ${entry.label.toLowerCase()} of $${formatCents(entry.cents)}`}
                onClick={() => { setEditingId(entry.id); setDraft(String(centsToDollars(entry.cents))); }}
                className={`${ICON_BUTTON} hover:text-foreground`}
              >
                <Pencil className='size-3.5' />
              </button>
              <button
                type='button'
                aria-label={`Delete ${entry.label.toLowerCase()} of $${formatCents(entry.cents)}`}
                onClick={() => void entry.onDelete()}
                className={`${ICON_BUTTON} hover:bg-destructive/20 hover:text-destructive`}
              >
                <Trash2 className='size-3.5' />
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

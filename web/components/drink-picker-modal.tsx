'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCents } from '@pb/core';
import { canMakeDrink } from '@/lib/recipes';
import { isDrinkArchived } from '@/lib/supabase/drink-stock';
import type { DrinkWithIngredients, InventoryRow, OrderRow } from '@/lib/supabase/queries';
import { cn } from '@/lib/utils';

interface Props {
  drinks: DrinkWithIngredients[];
  inventory: InventoryRow[];
  /** This night's orders, already loaded by the page: the picker ranks by them, no new query. */
  orders: readonly OrderRow[];
  playerName: string;
  /** The player's most recent drink, for "Same again"; null when they have none yet. */
  lastDrinkId: string | null;
  /** Resolves true once the pour is saved. Stock checks and "Pour anyway" live in the caller. */
  onPour: (drink: DrinkWithIngredients) => Promise<boolean>;
  onClose: () => void;
}

interface MenuEntry {
  drink: DrinkWithIngredients;
  available: boolean;
}

// Tonight's most-poured first, so the host's usual round is at the top; anything stock says
// is short goes last. Archived drinks are gone from the picker (0011). The sort is stable, so
// ties keep fetchDrinks' name order.
function menuOrder(drinks: readonly DrinkWithIngredients[], inventory: readonly InventoryRow[], orders: readonly OrderRow[]): MenuEntry[] {
  const pours = new Map<string, number>();
  for (const o of orders) if (o.drink_id) pours.set(o.drink_id, (pours.get(o.drink_id) ?? 0) + 1);
  return drinks
    .filter((drink) => !isDrinkArchived(drink))
    .map((drink) => ({ drink, available: canMakeDrink(drink, inventory), pours: pours.get(drink.id) ?? 0 }))
    .sort((a, b) => Number(b.available) - Number(a.available) || b.pours - a.pours);
}

// Stays open after a pour — a round is several drinks — and counts what was actually saved.
export function DrinkPickerModal({ drinks, inventory, orders, playerName, lastDrinkId, onPour, onClose }: Props) {
  const [added, setAdded] = useState(0);
  const menu = useMemo(() => menuOrder(drinks, inventory, orders), [drinks, inventory, orders]);
  const sameAgain = menu.find((entry) => entry.drink.id === lastDrinkId);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function pour(drink: DrinkWithIngredients) {
    if (await onPour(drink)) setAdded((n) => n + 1);
  }

  return (
    <div className='fixed inset-0 z-50 flex flex-col justify-end'>
      <div className='absolute inset-0 bg-black/70' onClick={onClose} />

      <div className='relative bg-card rounded-t-xl max-h-[85vh] flex flex-col' role='dialog' aria-modal='true' aria-label={`Drinks for ${playerName}`}>
        <div className='flex items-center justify-between gap-3 px-6 py-3 border-b border-border shrink-0'>
          <div className='min-w-0'>
            <h2 className='text-xs tracking-widest uppercase text-primary font-medium truncate'>Drinks for {playerName}</h2>
            <p className='text-xs text-muted-foreground tabular-nums' aria-live='polite'>
              {added > 0 ? `Added ${added}` : 'Tap to pour'}
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='h-11 shrink-0 px-4 rounded border border-border text-xs tracking-widest uppercase hover:border-foreground/30 transition-colors'
          >
            Done
          </button>
        </div>

        <div className='overflow-y-auto p-4 space-y-3'>
          {sameAgain && (
            <button
              type='button'
              onClick={() => pour(sameAgain.drink)}
              className='w-full min-h-11 rounded border border-primary/60 px-4 py-3 text-left flex items-center justify-between gap-3 hover:border-primary active:scale-[0.98] transition'
            >
              <span className='text-sm'>
                <span className='text-xs tracking-widest uppercase text-primary mr-2'>Same again</span>
                {sameAgain.drink.name}
              </span>
              <span className='text-sm font-semibold tabular-nums text-primary'>${formatCents(sameAgain.drink.price_cents)}</span>
            </button>
          )}
          {menu.length === 0 && (
            <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-8'>No drinks on the menu</p>
          )}
          <div className='grid grid-cols-2 gap-2'>
            {menu.map(({ drink, available }) => (
              <button
                key={drink.id}
                type='button'
                onClick={() => pour(drink)}
                className={cn(
                  'rounded border p-4 text-left transition-colors min-h-[72px] flex flex-col justify-between active:scale-95',
                  available
                    ? 'bg-secondary hover:bg-secondary/70 border-border'
                    : 'border-dashed border-border text-muted-foreground',
                )}
              >
                <span className='text-sm leading-snug'>{drink.name}</span>
                <span className='flex items-baseline justify-between gap-2 mt-1'>
                  <span className={cn('text-sm font-semibold tabular-nums', available ? 'text-primary' : 'text-muted-foreground')}>
                    ${formatCents(drink.price_cents)}
                  </span>
                  {!available && <span className='text-[10px] tracking-widest uppercase'>Out · Pour anyway</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

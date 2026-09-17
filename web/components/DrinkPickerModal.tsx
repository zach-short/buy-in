'use client';

import { useEffect } from 'react';
import { DrinkRecipe, InventoryItem } from '@/lib/bar-api';
import { cn } from '@/lib/utils';

interface Props {
  drinks: DrinkRecipe[];
  inventory: InventoryItem[];
  onSelect: (drink: DrinkRecipe) => void;
  onClose: () => void;
}

function isDrinkAvailable(drink: DrinkRecipe, inventory: InventoryItem[]): boolean {
  return drink.ingredients.every((ing) => {
    const item = inventory.find((i) => i.id === ing.itemId);
    return item && item.qtyOnHand >= ing.qtyUsed;
  });
}

export function DrinkPickerModal({ drinks, inventory, onSelect, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className='fixed inset-0 z-50 flex flex-col justify-end'>
      <div className='absolute inset-0 bg-black/70' onClick={onClose} />

      <div className='relative bg-card rounded-t-xl max-h-[85vh] flex flex-col'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-border shrink-0'>
          <h2 className='text-xs tracking-widest uppercase text-primary font-medium'>Select a Drink</h2>
          <button
            onClick={onClose}
            className='text-muted-foreground hover:text-foreground transition-colors text-lg leading-none px-2'
          >
            ×
          </button>
        </div>

        <div className='overflow-y-auto p-4'>
          <div className='grid grid-cols-2 gap-2'>
            {drinks.map((drink) => {
              const available = isDrinkAvailable(drink, inventory);
              return (
                <button
                  key={drink.id}
                  onClick={() => available && onSelect(drink)}
                  disabled={!available}
                  className={cn(
                    'rounded border p-4 text-left transition-colors min-h-[72px] flex flex-col justify-between',
                    available
                      ? 'bg-secondary hover:bg-secondary/70 border-border active:scale-95'
                      : 'border-border/30 opacity-30 cursor-not-allowed'
                  )}
                >
                  <span className='text-sm leading-snug'>{drink.name}</span>
                  <span className={cn('text-sm font-semibold mt-1 tabular-nums', available ? 'text-primary' : 'text-muted-foreground')}>
                    ${drink.price.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

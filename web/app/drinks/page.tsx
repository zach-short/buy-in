'use client';

import { useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { formatCents } from '@pb/core';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

import { DataState } from '@/components/shared/data-state';
import { HeaderAction, PageHeader, PageMain } from '@/components/shared/layout/page';
import { Input } from '@/components/ui/input';
import { canMakeDrink } from '@/lib/recipes';
import { isDrinkArchived } from '@/lib/supabase/drink-stock';
import {
  fetchDrinks, fetchInventory, type DrinkWithIngredients, type InventoryRow,
} from '@/lib/supabase/queries';
import { DrinkEditor } from './drink-editor';
import { drinkToForm, EMPTY_DRINK, isLossMaking, liveCostCents, marginLabel } from './drink-form';
import { useDrinkSaves } from './use-drink-saves';

const NOTE = 'text-center text-xs tracking-widest uppercase py-12 text-muted-foreground';

export default function DrinksPage() {
  const { data: drinks, error, mutate } = useSWR('drinks', fetchDrinks);
  const { data: inventory = [], mutate: mutateInventory } = useSWR('inventory', fetchInventory);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const saves = useDrinkSaves({
    inventory,
    refresh: () => { mutate(); mutateInventory(); },
    onCreated: () => setShowAdd(false),
    onUpdated: () => setExpandedId(null),
  });

  return (
    <PageMain>
      <PageHeader
        title='Drinks'
        actions={
          <HeaderAction tone={showAdd ? 'default' : 'primary'} onClick={() => { setShowAdd((v) => !v); setExpandedId(null); }}>
            {showAdd ? 'Cancel' : '+ Add'}
          </HeaderAction>
        }
      />

      {showAdd && (
        <div className='border border-border rounded-md p-4 mb-6'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>New Drink</p>
          <DrinkEditor
            drink={EMPTY_DRINK}
            inventory={inventory}
            onSave={saves.create}
            onCancel={() => setShowAdd(false)}
            isNew
          />
        </div>
      )}

      <Input
        type='search'
        aria-label='Search drinks'
        placeholder='Search drinks…'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className='h-11 mb-4'
      />

      <DataState
        rows={drinks}
        error={error}
        onRetry={() => mutate()}
        empty={<p className={NOTE}>No drinks yet — add your first</p>}
      >
        {(rows) => {
          // Filtered here, not in fetchDrinks, so the Archived section below can list them.
          const matching = rows.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
          const active = matching.filter((d) => !isDrinkArchived(d));
          const archived = matching.filter((d) => isDrinkArchived(d));
          return (
            <>
              <div className='space-y-2'>
                {active.map((drink) => (
                  <DrinkRow
                    key={drink.id}
                    drink={drink}
                    inventory={inventory}
                    open={expandedId === drink.id}
                    onToggle={() => setExpandedId(expandedId === drink.id ? null : drink.id)}
                  >
                    <DrinkEditor
                      drink={drinkToForm(drink)}
                      inventory={inventory}
                      onSave={(form) => saves.update(drink, form)}
                      onCancel={() => setExpandedId(null)}
                      onArchive={() => saves.setArchived(drink, true)}
                    />
                  </DrinkRow>
                ))}
                {active.length === 0 && <p className={NOTE}>No matching drinks</p>}
              </div>
              {archived.length > 0 && (
                <ArchivedDrinks drinks={archived} onRestore={(drink) => saves.setArchived(drink, false)} />
              )}
            </>
          );
        }}
      </DataState>
    </PageMain>
  );
}

function DrinkRow({ drink, inventory, open, onToggle, children }: {
  drink: DrinkWithIngredients;
  inventory: InventoryRow[];
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const available = canMakeDrink(drink, inventory);
  const costCents = liveCostCents(drink, inventory);
  const loss = isLossMaking(drink.price_cents, costCents);
  const margin = marginLabel(drink.price_cents, costCents);
  return (
    <div className='border border-border rounded-md'>
      <button className='w-full flex items-center justify-between px-4 py-4 min-h-[60px]' onClick={onToggle}>
        <div className='text-left'>
          <p className={`text-sm${available ? '' : ' text-muted-foreground'}`}>{drink.name}</p>
          {/* canMakeDrink says only whether, not which ingredient, so the reason stays general. */}
          {!available && <p className='text-xs text-destructive mt-0.5'>Out of stock · hidden from the menu</p>}
          <p className='text-xs text-muted-foreground mt-0.5'>
            ${formatCents(drink.price_cents)} sell · ${formatCents(costCents)} cost
            {margin && !loss && <> · {margin}</>}
            {loss && <span className='text-destructive'> · Sells at a loss</span>}
          </p>
        </div>
        {open ? <ChevronUp className='size-4 text-muted-foreground' /> : <ChevronDown className='size-4 text-muted-foreground' />}
      </button>
      {open && <div className='px-4 pb-4 border-t border-border'>{children}</div>}
    </div>
  );
}

function ArchivedDrinks({ drinks, onRestore }: {
  drinks: DrinkWithIngredients[];
  onRestore: (drink: DrinkWithIngredients) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className='mt-10'>
      <button
        className='w-full flex items-center justify-between min-h-11 text-xs tracking-widest uppercase text-muted-foreground'
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Archived ({drinks.length})
        {open ? <ChevronUp className='size-4' /> : <ChevronDown className='size-4' />}
      </button>
      {open && (
        <div className='space-y-2 mt-2'>
          {drinks.map((drink) => (
            <div key={drink.id} className='flex items-center justify-between border border-border rounded-md px-4 min-h-[60px] opacity-60'>
              <p className='text-sm'>{drink.name}</p>
              <button
                className='flex items-center gap-1.5 min-h-11 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground'
                onClick={() => onRestore(drink)}
              >
                <RotateCcw className='size-3.5' /> Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

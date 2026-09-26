'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { centsToDollars, formatCents, toCents } from '@pb/core';
import { canMakeDrink, recipeCostCents } from '@/lib/recipes';
import {
  fetchDrinks, fetchInventory, type DrinkWithIngredients, type InventoryRow,
} from '@/lib/supabase/queries';
import { saveDrink, type DrinkFields } from '@/lib/supabase/writes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Trash2, Check, Plus } from 'lucide-react';

type IngForm = { itemId: string; qtyUsed: string };
type DrinkForm = { name: string; price: string; ingredients: IngForm[] };

const emptyDrink: DrinkForm = { name: '', price: '', ingredients: [] };

function calcCostCents(ingredients: IngForm[], inventory: InventoryRow[]): number {
  return recipeCostCents(
    ingredients.map((ing) => ({ item_id: ing.itemId, qty_used: parseFloat(ing.qtyUsed) || 0 })),
    inventory,
  );
}

function DrinkEditor({
  drink,
  inventory,
  onSave,
  onCancel,
}: {
  drink: DrinkForm;
  inventory: InventoryRow[];
  onSave: (d: DrinkForm) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<DrinkForm>(drink);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof DrinkForm>(k: K, v: DrinkForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function updateIng(i: number, field: keyof IngForm, val: string) {
    setForm((f) => {
      const ings = [...f.ingredients];
      ings[i] = { ...ings[i], [field]: val };
      return { ...f, ingredients: ings };
    });
  }

  function addIng() {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { itemId: '', qtyUsed: '' }] }));
  }

  function removeIng(i: number) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));
  }

  async function handleSave() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  const costCents = calcCostCents(form.ingredients, inventory);

  return (
    <div className='space-y-3 pt-3 border-t border-border'>
      <Input placeholder='Drink name' value={form.name} onChange={(e) => setField('name', e.target.value)} className='h-11' />
      <div className='flex gap-3 items-center'>
        <Input type='number' placeholder='Price $' value={form.price} onChange={(e) => setField('price', e.target.value)} className='h-11 flex-1' />
        <p className='text-sm text-muted-foreground whitespace-nowrap'>Cost: ${formatCents(costCents)}</p>
      </div>

      <div className='space-y-2'>
        <p className='text-xs text-muted-foreground font-medium'>Ingredients</p>
        {form.ingredients.map((ing, i) => {
          const invItem = inventory.find((item) => item.id === ing.itemId);
          return (
            <div key={i} className='flex gap-2 items-center'>
              <select
                value={ing.itemId}
                onChange={(e) => updateIng(i, 'itemId', e.target.value)}
                className='flex-1 h-10 rounded-md border border-input bg-transparent px-2 text-sm'
              >
                <option value=''>Select item…</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <Input
                type='number'
                placeholder='Qty'
                value={ing.qtyUsed}
                onChange={(e) => updateIng(i, 'qtyUsed', e.target.value)}
                className='h-10 w-20'
              />
              <span className='text-xs text-muted-foreground w-8 shrink-0'>{invItem?.unit ?? ''}</span>
              <button onClick={() => removeIng(i)} className='size-10 flex items-center justify-center text-muted-foreground hover:text-destructive'>
                <Trash2 className='size-4' />
              </button>
            </div>
          );
        })}
        <button onClick={addIng} className='flex items-center gap-1.5 text-sm text-primary min-h-[40px]'>
          <Plus className='size-3.5' /> Add ingredient
        </button>
      </div>

      <div className='flex gap-2'>
        <Button className='flex-1 h-10' onClick={handleSave} disabled={saving || !form.name.trim()}>
          <Check className='size-4' /> {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant='outline' className='h-10 px-4' onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// The cost estimate is stored in whole cents; recipeCostCents is fractional (a recipe
// uses fractional quantities), so it rounds here, once, the way the import rounds the
// same figure (H5: half away from zero, which Math.round is for a non-negative cost).
function buildDrink(form: DrinkForm, inventory: InventoryRow[]): DrinkFields {
  const ingredients = form.ingredients
    .filter((i) => i.itemId && i.qtyUsed)
    .map((i) => ({ itemId: i.itemId, qtyUsed: parseFloat(i.qtyUsed) }));
  return {
    name: form.name.trim(),
    priceCents: toCents(parseFloat(form.price) || 0),
    costEstimateCents: Math.round(calcCostCents(form.ingredients, inventory)),
    ingredients,
  };
}

function drinkToForm(drink: DrinkWithIngredients): DrinkForm {
  return {
    name: drink.name,
    price: String(centsToDollars(drink.price_cents)),
    ingredients: drink.ingredients.map((i) => ({ itemId: i.item_id, qtyUsed: String(i.qty_used) })),
  };
}


export default function DrinksPage() {
  const router = useRouter();
  const { data: drinks = [], mutate } = useSWR('drinks', fetchDrinks);
  const { data: inventory = [] } = useSWR('inventory', fetchInventory);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');


  async function handleCreate(form: DrinkForm) {
    try {
      await saveDrink(buildDrink(form, inventory));
      toast.success('Drink created');
      setShowAdd(false);
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleUpdate(drink: DrinkWithIngredients, form: DrinkForm) {
    try {
      await saveDrink(buildDrink(form, inventory), drink.id);
      toast.success('Drink updated');
      setExpandedId(null);
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <main className='min-h-screen px-6 py-10 max-w-lg mx-auto pb-24'>
      <div className='flex items-center justify-between mb-10'>
        <button
          onClick={() => router.back()}
          className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors min-h-[44px]'
        >
          ← Back
        </button>
        <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Drinks</h1>
        <button
          onClick={() => { setShowAdd((v) => !v); setExpandedId(null); }}
          className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors min-h-[44px]'
        >
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showAdd && (
        <div className='border border-border rounded-md p-4 mb-6'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>New Drink</p>
          <DrinkEditor
            drink={emptyDrink}
            inventory={inventory}
            onSave={handleCreate}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      <Input
        placeholder='Search drinks…'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className='h-11 mb-4'
      />

      <div className='space-y-2'>
        {drinks.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())).map((drink) => {
          const open = expandedId === drink.id;
          const available = canMakeDrink(drink, inventory);
          const costCents = recipeCostCents(drink.ingredients, inventory);
          return (
            <div key={drink.id} className={`border border-border rounded-md${available ? '' : ' opacity-40'}`}>
              <button
                className='w-full flex items-center justify-between px-4 py-4 min-h-[60px]'
                onClick={() => setExpandedId(open ? null : drink.id)}
              >
                <div className='text-left'>
                  <p className='text-sm'>{drink.name}</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    ${formatCents(drink.price_cents)} sell · ${formatCents(costCents)} cost
                  </p>
                </div>
                {open ? <ChevronUp className='size-4 text-muted-foreground' /> : <ChevronDown className='size-4 text-muted-foreground' />}
              </button>

              {open && (
                <div className='px-4 pb-4 border-t border-border'>
                  <DrinkEditor
                    drink={drinkToForm(drink)}
                    inventory={inventory}
                    onSave={(form) => handleUpdate(drink, form)}
                    onCancel={() => setExpandedId(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { fetcher, apiFetch, canMake, DrinkRecipe, InventoryItem } from '@/lib/bar-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Trash2, Check, Plus } from 'lucide-react';

type IngForm = { itemId: string; qtyUsed: string };
type DrinkForm = { name: string; price: string; ingredients: IngForm[] };

const emptyDrink: DrinkForm = { name: '', price: '', ingredients: [] };

function calcCost(ingredients: IngForm[], inventory: InventoryItem[]): number {
  const map = new Map(inventory.map((item) => [item.id, item]));
  return ingredients.reduce((sum, ing) => {
    const item = map.get(ing.itemId);
    if (!item) return sum;
    return sum + (parseFloat(ing.qtyUsed) || 0) * item.costPerUnit;
  }, 0);
}

function DrinkEditor({
  drink,
  inventory,
  onSave,
  onCancel,
}: {
  drink: DrinkForm;
  inventory: InventoryItem[];
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

  const cost = calcCost(form.ingredients, inventory);

  return (
    <div className='space-y-3 pt-3 border-t border-border'>
      <Input placeholder='Drink name' value={form.name} onChange={(e) => setField('name', e.target.value)} className='h-11' />
      <div className='flex gap-3 items-center'>
        <Input type='number' placeholder='Price $' value={form.price} onChange={(e) => setField('price', e.target.value)} className='h-11 flex-1' />
        <p className='text-sm text-muted-foreground whitespace-nowrap'>Cost: ${cost.toFixed(2)}</p>
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

function buildPayload(form: DrinkForm, inventory: InventoryItem[]) {
  const ingredients = form.ingredients
    .filter((i) => i.itemId && i.qtyUsed)
    .map((i) => ({ itemId: i.itemId, qtyUsed: parseFloat(i.qtyUsed) }));
  return {
    name: form.name.trim(),
    price: parseFloat(form.price) || 0,
    costEstimate: calcCost(form.ingredients, inventory),
    ingredients,
  };
}

function drinkToForm(drink: DrinkRecipe): DrinkForm {
  return {
    name: drink.name,
    price: String(drink.price),
    ingredients: drink.ingredients.map((i) => ({ itemId: i.itemId, qtyUsed: String(i.qtyUsed) })),
  };
}


export default function DrinksPage() {
  const router = useRouter();
  const { data: drinks = [], mutate } = useSWR<DrinkRecipe[]>('/api/drinks', fetcher);
  const { data: inventory = [] } = useSWR<InventoryItem[]>('/api/inventory', fetcher);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  function drinkCost(drink: DrinkRecipe): number {
    return drink.ingredients.reduce((sum, ing) => {
      const item = inventory.find((i) => i.id === ing.itemId);
      return sum + ing.qtyUsed * (item?.costPerUnit ?? 0);
    }, 0);
  }

  async function handleCreate(form: DrinkForm) {
    try {
      await apiFetch<DrinkRecipe>('/api/drinks', { method: 'POST', body: JSON.stringify(buildPayload(form, inventory)) });
      toast.success('Drink created');
      setShowAdd(false);
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleUpdate(drink: DrinkRecipe, form: DrinkForm) {
    try {
      await apiFetch(`/api/drinks/${drink.id}`, { method: 'PUT', body: JSON.stringify(buildPayload(form, inventory)) });
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
          const available = canMake(drink, inventory);
          const cost = drinkCost(drink);
          return (
            <div key={drink.id} className={`border border-border rounded-md${available ? '' : ' opacity-40'}`}>
              <button
                className='w-full flex items-center justify-between px-4 py-4 min-h-[60px]'
                onClick={() => setExpandedId(open ? null : drink.id)}
              >
                <div className='text-left'>
                  <p className='text-sm'>{drink.name}</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    ${drink.price.toFixed(2)} sell · ${cost.toFixed(2)} cost
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

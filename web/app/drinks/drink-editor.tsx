import { useState, type FormEvent } from 'react';
import { formatCents } from '@pb/core';
import { Archive, Check, Plus, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import type { InventoryRow } from '@/lib/supabase/queries';
import { formCostCents, formPriceCents, isLossMaking, marginLabel, type DrinkForm, type IngForm } from './drink-form';

interface DrinkEditorProps {
  drink: DrinkForm;
  inventory: InventoryRow[];
  onSave: (d: DrinkForm) => Promise<void>;
  onCancel: () => void;
  /** Only a new drink can set up its own stock item; an existing one already has a recipe to edit. */
  isNew?: boolean;
  onArchive?: () => void;
}

export function DrinkEditor({ drink, inventory, onSave, onCancel, isNew = false, onArchive }: DrinkEditorProps) {
  const [form, setForm] = useState<DrinkForm>(drink);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof DrinkForm>(k: K, v: DrinkForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (saving || !form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className='space-y-3 pt-3 border-t border-border'>
      <Input
        placeholder='Drink name'
        aria-label='Drink name'
        autoCapitalize='words'
        autoComplete='off'
        value={form.name}
        onChange={(e) => setField('name', e.target.value)}
        className='h-11'
      />
      <div className='flex gap-3 items-center'>
        <MoneyInput
          placeholder='Price'
          aria-label='Price'
          value={form.price}
          onValueChange={(v) => setField('price', v)}
          containerClassName='flex-1'
        />
        <CostHint priceCents={formPriceCents(form)} costCents={formCostCents(form, inventory)} />
      </div>

      {isNew && (
        <label className='flex items-center gap-2 text-sm min-h-11'>
          <input
            type='checkbox'
            checked={form.trackStock}
            onChange={(e) => setField('trackStock', e.target.checked)}
            className='size-4 accent-primary'
          />
          Track stock (1 per pour)
        </label>
      )}

      {form.trackStock
        ? <StockFields form={form} setField={setField} />
        : <IngredientList ingredients={form.ingredients} inventory={inventory} onChange={(ings) => setField('ingredients', ings)} />}

      <div className='flex gap-2'>
        <Button type='submit' className='flex-1 h-11' disabled={saving || !form.name.trim()}>
          <Check className='size-4' /> {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type='button' variant='outline' className='h-11 px-4' onClick={onCancel}><X aria-hidden='true' /> Cancel</Button>
        {onArchive && (
          <Button type='button' variant='outline' className='h-11 px-4' onClick={onArchive} disabled={saving}>
            <Archive className='size-4' /> Archive
          </Button>
        )}
      </div>
    </form>
  );
}

function CostHint({ priceCents, costCents }: { priceCents: number; costCents: number }) {
  const margin = marginLabel(priceCents, costCents);
  const loss = isLossMaking(priceCents, costCents);
  return (
    <p className='text-sm text-muted-foreground whitespace-nowrap text-right'>
      Cost: ${formatCents(costCents)}
      {margin && <span className={`block text-xs ${loss ? 'text-destructive' : ''}`}>{margin}</span>}
    </p>
  );
}

function StockFields({ form, setField }: {
  form: DrinkForm;
  setField: <K extends keyof DrinkForm>(k: K, v: DrinkForm[K]) => void;
}) {
  return (
    <div className='space-y-2'>
      <p className='text-xs text-muted-foreground'>
        Adds a stock item of the same name, counted each, and a recipe that pours one of it.
      </p>
      <div className='flex gap-3'>
        <Input
          type='text'
          inputMode='decimal'
          placeholder='On hand'
          aria-label='On hand'
          value={form.stockQty}
          onChange={(e) => setField('stockQty', e.target.value)}
          className='h-11 w-28'
        />
        <MoneyInput
          placeholder='Cost each'
          aria-label='Cost each'
          value={form.unitCost}
          onValueChange={(v) => setField('unitCost', v)}
          containerClassName='flex-1'
        />
      </div>
    </div>
  );
}

function IngredientList({ ingredients, inventory, onChange }: {
  ingredients: IngForm[];
  inventory: InventoryRow[];
  onChange: (ings: IngForm[]) => void;
}) {
  function update(i: number, field: keyof IngForm, val: string) {
    onChange(ingredients.map((ing, idx) => (idx === i ? { ...ing, [field]: val } : ing)));
  }

  return (
    <div className='space-y-2'>
      <p className='text-xs text-muted-foreground font-medium'>Ingredients</p>
      {ingredients.map((ing, i) => {
        const invItem = inventory.find((item) => item.id === ing.itemId);
        return (
          <div key={i} className='flex gap-2 items-center'>
            <select
              value={ing.itemId}
              onChange={(e) => update(i, 'itemId', e.target.value)}
              aria-label='Ingredient'
              className='flex-1 min-w-0 h-11 rounded-md border border-input bg-transparent px-2 text-base md:text-sm'
            >
              <option value=''>Select item…</option>
              {inventory.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <Input
              type='text'
              inputMode='decimal'
              placeholder='Qty'
              aria-label='Quantity used'
              value={ing.qtyUsed}
              onChange={(e) => update(i, 'qtyUsed', e.target.value)}
              className='h-11 w-20'
            />
            <span className='text-xs text-muted-foreground w-8 shrink-0'>{invItem?.unit ?? ''}</span>
            <button
              type='button'
              aria-label='Remove ingredient'
              onClick={() => onChange(ingredients.filter((_, idx) => idx !== i))}
              className='size-11 shrink-0 flex items-center justify-center text-muted-foreground hover:text-destructive'
            >
              <Trash2 className='size-4' />
            </button>
          </div>
        );
      })}
      <button
        type='button'
        onClick={() => onChange([...ingredients, { itemId: '', qtyUsed: '' }])}
        className='flex items-center gap-1.5 text-sm text-primary min-h-11'
      >
        <Plus className='size-3.5' /> Add ingredient
      </button>
    </div>
  );
}

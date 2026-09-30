import { useState, type FormEvent } from 'react';
import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import type { InventoryRow } from '@/lib/supabase/queries';
import { cn } from '@/lib/utils';
import { CATEGORIES } from './stock';

export interface ItemFormValues {
  name: string;
  category: string;
  unit: string;
  qtyOnHand: string;
  reorderThreshold: string;
  costPerUnit: string;
}

export const EMPTY_ITEM_FORM: ItemFormValues = {
  name: '', category: 'Spirit', unit: 'oz', qtyOnHand: '', reorderThreshold: '', costPerUnit: '',
};

export function itemFormValues(item: InventoryRow): ItemFormValues {
  return {
    name: item.name,
    category: item.category,
    unit: item.unit,
    qtyOnHand: String(item.qty_on_hand),
    reorderThreshold: String(item.reorder_threshold),
    costPerUnit: item.cost_per_unit_cents ? String(item.cost_per_unit_cents / 100) : '',
  };
}

interface ItemFormProps {
  title: string;
  initial: ItemFormValues;
  /** Editing leaves stock to the row's own editor and restock, so it hides the qty field. */
  showQty: boolean;
  /** Resolves true when saved; the caller has already toasted why not. */
  onSubmit: (values: ItemFormValues) => Promise<boolean>;
  onCancel?: () => void;
  className?: string;
}

export function ItemForm({ title, initial, showQty, onSubmit, onCancel, className }: ItemFormProps) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof ItemFormValues) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  // An item from a category the form does not offer keeps it rather than being silently moved.
  const offered: readonly string[] = CATEGORIES;
  const categories = offered.includes(initial.category) ? offered : [...offered, initial.category];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !form.name.trim() || !form.unit.trim()) return;
    setSaving(true);
    const saved = await onSubmit(form);
    setSaving(false);
    if (saved && showQty) setForm(EMPTY_ITEM_FORM);
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={cn('border border-border rounded-md p-4 space-y-3', className)}>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-1'>{title}</p>
      <Input
        placeholder='Name'
        aria-label='Name'
        autoCapitalize='words'
        autoComplete='off'
        value={form.name}
        onChange={(e) => set('name')(e.target.value)}
        className='h-11'
      />
      <div className='grid grid-cols-2 gap-2'>
        <select
          value={form.category}
          onChange={(e) => set('category')(e.target.value)}
          aria-label='Category'
          className='h-11 rounded-md border border-input bg-transparent px-3 text-base md:text-sm'
        >
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Input placeholder='Unit (oz, each…)' aria-label='Unit' autoComplete='off' value={form.unit} onChange={(e) => set('unit')(e.target.value)} className='h-11' />
      </div>
      <div className={showQty ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
        {showQty && <QtyField placeholder='Qty' value={form.qtyOnHand} onChange={set('qtyOnHand')} />}
        <QtyField placeholder='Reorder at' value={form.reorderThreshold} onChange={set('reorderThreshold')} />
        <MoneyInput placeholder='Cost/unit' aria-label='Cost per unit' value={form.costPerUnit} onValueChange={set('costPerUnit')} />
      </div>
      <div className='flex gap-2'>
        {onCancel && (
          <Button type='button' variant='outline' className='flex-1 h-11 tracking-widest uppercase text-xs' onClick={onCancel} disabled={saving}>
            <X aria-hidden='true' />
            Cancel
          </Button>
        )}
        <Button type='submit' className='flex-1 h-11 tracking-widest uppercase text-xs' disabled={saving || !form.name.trim() || !form.unit.trim()}>
          <Check aria-hidden='true' />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export function QtyField({ value, onChange, placeholder, className = 'h-11' }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <Input
      type='text'
      inputMode='decimal'
      autoComplete='off'
      placeholder={placeholder}
      aria-label={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
      className={`${className} tabular-nums`}
    />
  );
}

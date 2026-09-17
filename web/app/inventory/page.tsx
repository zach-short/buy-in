'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { fetcher, apiFetch, InventoryItem } from '@/lib/bar-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';

const CATEGORIES = ['Spirit', 'Mixer', 'Syrup', 'Garnish', 'Equipment'] as const;

function QtyEditor({ item, onSave }: { item: InventoryItem; onSave: (qty: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(item.qtyOnHand));
  const [saving, setSaving] = useState(false);

  async function save() {
    const qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) return;
    setSaving(true);
    await onSave(qty);
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(String(item.qtyOnHand)); setEditing(true); }}
        className='text-right min-w-[56px] min-h-[40px] px-2 rounded hover:bg-secondary transition-colors tabular-nums text-sm'
      >
        {item.qtyOnHand} {item.unit}
      </button>
    );
  }

  return (
    <div className='flex items-center gap-1'>
      <Input
        type='number'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        className='h-9 w-20 text-right text-sm'
        autoFocus
      />
      <button
        onClick={save}
        disabled={saving}
        className='size-9 flex items-center justify-center rounded bg-primary text-primary-foreground'
      >
        <Check className='size-4' />
      </button>
    </div>
  );
}

type AddForm = {
  name: string;
  category: string;
  unit: string;
  qtyOnHand: string;
  reorderThreshold: string;
  costPerUnit: string;
};

const emptyForm: AddForm = { name: '', category: 'Spirit', unit: 'oz', qtyOnHand: '', reorderThreshold: '', costPerUnit: '' };

export default function InventoryPage() {
  const router = useRouter();
  const { data: items = [], mutate } = useSWR<InventoryItem[]>('/api/inventory', fetcher);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(emptyForm);
  const [adding, setAdding] = useState(false);

  async function updateQty(item: InventoryItem, qty: number) {
    try {
      await apiFetch(`/api/inventory/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ qtyOnHand: qty }),
      });
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addItem() {
    if (!form.name.trim() || !form.category || !form.unit) return;
    setAdding(true);
    try {
      await apiFetch<InventoryItem>('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          unit: form.unit,
          qtyOnHand: parseFloat(form.qtyOnHand) || 0,
          reorderThreshold: parseFloat(form.reorderThreshold) || 0,
          costPerUnit: parseFloat(form.costPerUnit) || 0,
        }),
      });
      toast.success('Item added');
      setForm(emptyForm);
      setShowAdd(false);
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  const grouped = CATEGORIES.reduce<Record<string, InventoryItem[]>>((acc, cat) => {
    acc[cat] = items.filter((i) => i.category === cat);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  return (
    <main className='min-h-screen px-6 py-10 max-w-lg mx-auto pb-24'>
      <div className='flex items-center justify-between mb-10'>
        <button
          onClick={() => router.back()}
          className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors min-h-[44px]'
        >
          ← Back
        </button>
        <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Inventory</h1>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors min-h-[44px]'
        >
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showAdd && (
        <div className='border border-border rounded-md p-4 mb-8 space-y-3'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-1'>New Item</p>
          <Input placeholder='Name' value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className='h-11' />
          <div className='grid grid-cols-2 gap-2'>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className='h-11 rounded-md border border-input bg-transparent px-3 text-sm'
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Input placeholder='Unit (oz, each…)' value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className='h-11' />
          </div>
          <div className='grid grid-cols-3 gap-2'>
            <Input type='number' placeholder='Qty' value={form.qtyOnHand} onChange={(e) => setForm((f) => ({ ...f, qtyOnHand: e.target.value }))} className='h-11' />
            <Input type='number' placeholder='Reorder at' value={form.reorderThreshold} onChange={(e) => setForm((f) => ({ ...f, reorderThreshold: e.target.value }))} className='h-11' />
            <Input type='number' placeholder='$/unit' value={form.costPerUnit} onChange={(e) => setForm((f) => ({ ...f, costPerUnit: e.target.value }))} className='h-11' />
          </div>
          <Button className='w-full h-11 tracking-widest uppercase text-xs' onClick={addItem} disabled={adding || !form.name.trim()}>
            {adding ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}

      {CATEGORIES.map((cat) => {
        const catItems = grouped[cat];
        if (catItems.length === 0) return null;
        return (
          <div key={cat} className='mb-8'>
            <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>{cat}</p>
            <div className='border border-border rounded-md divide-y divide-border'>
              {catItems.map((item) => (
                <div key={item.id} className='flex items-center justify-between px-4 py-3 min-h-[52px]'>
                  <div className='flex items-center gap-2 min-w-0'>
                    {item.qtyOnHand <= item.reorderThreshold && (
                      <span className='text-destructive text-xs shrink-0'>!</span>
                    )}
                    <span className='text-sm truncate'>{item.name}</span>
                  </div>
                  <QtyEditor item={item} onSave={(qty) => updateQty(item, qty)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </main>
  );
}

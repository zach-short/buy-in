'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Check, Pencil } from 'lucide-react';
import { DataState } from '@/components/shared/data-state';
import { HeaderAction, PageHeader, PageMain } from '@/components/shared/layout/page';
import { parseMoneyInput } from '@/components/ui/money-input';
import { updateInventoryItem, type InventoryItemDetails } from '@/lib/supabase/inventory';
import { fetchInventory, type InventoryRow } from '@/lib/supabase/queries';
import { createInventoryItem, setInventoryQty } from '@/lib/supabase/writes';
import { EMPTY_ITEM_FORM, ItemForm, itemFormValues, QtyField, type ItemFormValues } from './item-form';
import { RunningLow } from './running-low';
import { formatQty, groupByCategory, nameClash, parseQty } from './stock';
import { useRestock } from './use-restock';

function QtyEditor({ item, onSave }: { item: InventoryRow; onSave: (qty: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(item.qty_on_hand));
  const [saving, setSaving] = useState(false);

  async function save() {
    const qty = parseQty(value);
    if (qty === null || Number.isNaN(qty)) return;
    setSaving(true);
    await onSave(qty);
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(String(item.qty_on_hand)); setEditing(true); }}
        className='text-right min-w-[56px] min-h-[40px] px-2 rounded hover:bg-secondary transition-colors tabular-nums text-sm'
      >
        {formatQty(item.qty_on_hand)} {item.unit}
      </button>
    );
  }

  return (
    <div className='flex items-center gap-1' onKeyDown={(e) => e.key === 'Enter' && save()}>
      <QtyField placeholder='Qty' value={value} onChange={setValue} className='h-9 w-20 text-right text-sm' />
      <button
        onClick={save}
        disabled={saving}
        aria-label='Save quantity'
        className='size-9 flex items-center justify-center rounded bg-primary text-primary-foreground'
      >
        <Check className='size-4' />
      </button>
    </div>
  );
}

/** The form's typed fields as a write, or the message saying why they cannot be one. */
function parseDetails(values: ItemFormValues): InventoryItemDetails | string {
  const reorderThreshold = parseQty(values.reorderThreshold) ?? 0;
  if (Number.isNaN(reorderThreshold)) return 'Reorder point must be a number';
  return {
    name: values.name.trim(),
    category: values.category,
    unit: values.unit.trim(),
    reorderThreshold,
    costPerUnitCents: parseMoneyInput(values.costPerUnit) ?? 0,
  };
}

// No unique constraint guards inventory names (0001), so the screen is the only check.
function checkDetails(items: InventoryRow[], values: ItemFormValues, exceptId?: string): InventoryItemDetails | null {
  const details = parseDetails(values);
  if (typeof details === 'string') {
    toast.error(details);
    return null;
  }
  if (nameClash(items, details.name, exceptId)) {
    toast.error(`There's already an item called ${details.name}`);
    return null;
  }
  return details;
}

export default function InventoryPage() {
  const { data, error, mutate } = useSWR('inventory', fetchInventory);
  const items = data ?? [];
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const restock = useRestock(items, mutate);

  async function updateQty(item: InventoryRow, qty: number) {
    try {
      await setInventoryQty(item.id, qty);
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addItem(values: ItemFormValues): Promise<boolean> {
    const details = checkDetails(items, values);
    const qtyOnHand = parseQty(values.qtyOnHand) ?? 0;
    if (!details) return false;
    if (Number.isNaN(qtyOnHand)) {
      toast.error('Qty must be a number');
      return false;
    }
    try {
      await createInventoryItem({ ...details, qtyOnHand });
      toast.success('Item added');
      setShowAdd(false);
      mutate();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  }

  async function editItem(item: InventoryRow, values: ItemFormValues): Promise<boolean> {
    const details = checkDetails(items, values, item.id);
    if (!details) return false;
    try {
      await updateInventoryItem(item.id, details);
      toast.success('Item saved');
      setEditingId(null);
      mutate();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  }

  function toggleRestock() {
    setShowAdd(false);
    setEditingId(null);
    restock.toggle();
  }

  return (
    <PageMain>
      <PageHeader
        title='Inventory'
        actions={
          <>
            {items.length > 0 && (
              <HeaderAction onClick={toggleRestock}>{restock.active ? 'Cancel' : 'Restock'}</HeaderAction>
            )}
            {!restock.active && (
              <HeaderAction onClick={() => setShowAdd((v) => !v)}>{showAdd ? 'Cancel' : '+ Add'}</HeaderAction>
            )}
          </>
        }
      />

      {showAdd && (
        <div className='mb-8'>
          <ItemForm title='New Item' initial={EMPTY_ITEM_FORM} showQty onSubmit={addItem} />
        </div>
      )}

      <DataState
        rows={data}
        error={error}
        onRetry={() => mutate()}
        empty={<p className='text-center text-xs tracking-widest uppercase py-12 text-muted-foreground'>No items yet — add your first bottle</p>}
      >
        {(rows) => (
          <>
            {!restock.active && <RunningLow items={rows} />}

            {restock.active && (
              <div className='mb-8 space-y-3'>
                <p className='text-xs text-muted-foreground'>Enter what arrived; it is added to what is on hand.</p>
                <button
                  type='button'
                  onClick={restock.save}
                  disabled={restock.saving}
                  className='w-full h-11 rounded-md bg-primary text-primary-foreground tracking-widest uppercase text-xs disabled:opacity-50'
                >
                  {restock.saving ? 'Saving…' : 'Save restock'}
                </button>
              </div>
            )}

            {groupByCategory(rows).map(([cat, catItems]) => (
              <div key={cat} className='mb-8'>
                <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>{cat}</p>
                <div className='border border-border rounded-md divide-y divide-border'>
                  {catItems.map((item) => editingId === item.id ? (
                    <ItemForm
                      key={item.id}
                      title={`Edit ${item.name}`}
                      initial={itemFormValues(item)}
                      showQty={false}
                      className='border-0 rounded-none'
                      onSubmit={(values) => editItem(item, values)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div key={item.id} className='flex items-center justify-between gap-2 px-4 py-3 min-h-[52px]'>
                      <div className='flex items-center gap-2 min-w-0'>
                        {item.qty_on_hand <= item.reorder_threshold && (
                          <span className='text-destructive text-xs shrink-0'>!</span>
                        )}
                        <span className='text-sm truncate'>{item.name}</span>
                      </div>
                      {restock.active ? (
                        <div className='flex items-center gap-2 shrink-0'>
                          <span className='text-xs text-muted-foreground tabular-nums'>{formatQty(item.qty_on_hand)} +</span>
                          <QtyField
                            placeholder='received'
                            value={restock.draft[item.id] ?? ''}
                            onChange={(v) => restock.setReceived(item.id, v)}
                            className='h-9 w-24 text-right text-sm'
                          />
                          <span className='text-xs text-muted-foreground w-10 truncate'>{item.unit}</span>
                        </div>
                      ) : (
                        <div className='flex items-center gap-1 shrink-0'>
                          <QtyEditor item={item} onSave={(qty) => updateQty(item, qty)} />
                          <button
                            type='button'
                            onClick={() => { setShowAdd(false); setEditingId(item.id); }}
                            aria-label={`Edit ${item.name}`}
                            className='size-9 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors'
                          >
                            <Pencil className='size-3.5' />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </DataState>
    </PageMain>
  );
}

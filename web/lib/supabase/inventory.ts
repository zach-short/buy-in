import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

// Inventory writes the Go API never had: editing an item's details after creation, and
// restocking by adding to what is on hand. RLS (0001 inventory_items_staff) lets bar staff
// write every column, so both are plain table writes. Create and set-qty stay in writes.ts.

function fail(error: PostgrestError): never {
  throw new Error(writeErrorMessage(error));
}

export interface InventoryItemDetails {
  name: string;
  category: string;
  unit: string;
  reorderThreshold: number;
  costPerUnitCents: number;
}

/** Everything about an item except its stock, which the row's own editor and restock own. */
export async function updateInventoryItem(id: string, details: InventoryItemDetails): Promise<void> {
  const { data, error } = await createClient().from('inventory_items')
    .update({
      name: details.name, category: details.category, unit: details.unit,
      reorder_threshold: details.reorderThreshold, cost_per_unit_cents: details.costPerUnitCents,
    })
    .eq('id', id).select('id');
  if (error) fail(error);
  if (!data?.length) throw new Error('Item not found');
}

// Orders decrement stock while a host restocks mid-game, so "on hand + received" computed
// from the screen's copy could overwrite a sale. The update only lands if on-hand is still
// what was just read; a lost race re-reads and tries again.
const RESTOCK_ATTEMPTS = 3;

/** Adds `received` to the item's current on-hand quantity. */
export async function addInventoryStock(id: string, received: number): Promise<void> {
  const client = createClient();
  for (let attempt = 0; attempt < RESTOCK_ATTEMPTS; attempt++) {
    const { data: row, error: readError } = await client.from('inventory_items')
      .select('qty_on_hand').eq('id', id).maybeSingle();
    if (readError) fail(readError);
    if (!row) throw new Error('Item not found');
    const { data, error } = await client.from('inventory_items')
      .update({ qty_on_hand: row.qty_on_hand + received })
      .eq('id', id).eq('qty_on_hand', row.qty_on_hand).select('id');
    if (error) fail(error);
    if (data?.length) return;
  }
  throw new Error('Stock kept changing — try again');
}

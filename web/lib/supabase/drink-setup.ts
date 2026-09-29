import { writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';
import { fetchBarId } from '@/lib/supabase/queries';
import { saveDrink } from '@/lib/supabase/writes';

// A beer or a can of soda is its own ingredient: one inventory item, one drink, a recipe of
// exactly one of it. Without this a host builds that by hand across two screens. It is two
// writes, not one RPC — nothing in 0002 creates an item and a drink together, and a new RPC
// would need a migration — so the second can fail after the first has landed.

// Beer and soda have no category of their own; 0001's check allows only these five, and
// Mixer is the one a can already fits.
const SIMPLE_DRINK_CATEGORY = 'Mixer';

export interface SimpleDrinkFields {
  name: string;
  priceCents: number;
  qtyOnHand: number;
  costPerUnitCents: number;
}

async function insertEachItem(fields: SimpleDrinkFields): Promise<string> {
  const { data, error } = await createClient().from('inventory_items').insert({
    bar_id: await fetchBarId(), name: fields.name, category: SIMPLE_DRINK_CATEGORY, unit: 'each',
    qty_on_hand: fields.qtyOnHand, cost_per_unit_cents: fields.costPerUnitCents,
  }).select('id').single();
  if (error) throw new Error(writeErrorMessage(error));
  return data.id;
}

/**
 * Creates an 'each' inventory item and a drink that pours one of it. If the drink fails after
 * the item landed, the error says the item exists, so the host can reuse it or remove it.
 */
export async function createSimpleDrink(fields: SimpleDrinkFields): Promise<void> {
  const itemId = await insertEachItem(fields);
  try {
    await saveDrink({
      name: fields.name,
      priceCents: fields.priceCents,
      // One unit per pour, so the recipe cost is the unit cost exactly; stored as the fallback.
      costEstimateCents: fields.costPerUnitCents,
      ingredients: [{ itemId, qtyUsed: 1 }],
    });
  } catch (e) {
    throw new Error(`Stock item "${fields.name}" was added, but the drink was not: ${(e as Error).message}`);
  }
}

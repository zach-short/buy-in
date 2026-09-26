import { canMake } from '@pb/core';

import type { DrinkWithIngredients, IngredientRow, InventoryRow } from '@/lib/supabase/queries';

// Adapts Postgres rows to @pb/core's canMake, which moved there from bar-api.ts with its
// semantics intact — including that a drink with no recipe is always makeable.
export function canMakeDrink(drink: DrinkWithIngredients, inventory: readonly InventoryRow[]): boolean {
  return canMake(
    { ingredients: drink.ingredients.map((i) => ({ itemId: i.item_id, qtyUsed: i.qty_used })) },
    inventory.map((item) => ({ id: item.id, qtyOnHand: item.qty_on_hand })),
  );
}

/**
 * What a recipe's ingredients cost at today's unit prices, in cents. Fractional — a
 * recipe uses fractional quantities (0001_init.sql numeric(12,3)) — so it is only ever
 * rendered through formatCents, never stored from here.
 */
export function recipeCostCents(ingredients: readonly IngredientRow[], inventory: readonly InventoryRow[]): number {
  const unitCents = new Map(inventory.map((item) => [item.id, item.cost_per_unit_cents]));
  return ingredients.reduce((sum, ing) => sum + ing.qty_used * (unitCents.get(ing.item_id) ?? 0), 0);
}

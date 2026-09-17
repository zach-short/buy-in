// Quantities are NOT cents — the schema stores them as numeric(12,3)
// (supabase/migrations/0001_init.sql), because a recipe uses fractional ounces.
// Only money is integer cents.

export interface IngredientLike {
  itemId: string;
  qtyUsed: number;
}

export interface StockLike {
  id: string;
  qtyOnHand: number;
}

export interface RecipeLike {
  ingredients: readonly IngredientLike[];
}

/**
 * Moved from web/lib/bar-api.ts:106-109 with its semantics intact, including the one
 * that is easy to lose: a drink with an empty recipe is always makeable, because
 * `every` on an empty array is true.
 */
export function canMake(drink: RecipeLike, inventory: readonly StockLike[]): boolean {
  const stock = new Map(inventory.map((item) => [item.id, item.qtyOnHand]));
  return drink.ingredients.every((ing) => (stock.get(ing.itemId) ?? 0) >= ing.qtyUsed);
}

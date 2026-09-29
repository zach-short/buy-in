import { formatCents } from '@pb/core';

import { parseMoneyInput } from '@/components/ui/money-input';
import { recipeCostCents } from '@/lib/recipes';
import type { SimpleDrinkFields } from '@/lib/supabase/drink-setup';
import type { DrinkWithIngredients, InventoryRow } from '@/lib/supabase/queries';
import type { DrinkFields } from '@/lib/supabase/writes';

export type IngForm = { itemId: string; qtyUsed: string };

export type DrinkForm = {
  name: string;
  price: string;
  ingredients: IngForm[];
  /** New drinks only: create an 'each' stock item and a one-per-pour recipe with the drink. */
  trackStock: boolean;
  stockQty: string;
  unitCost: string;
};

export const EMPTY_DRINK: DrinkForm = { name: '', price: '', ingredients: [], trackStock: false, stockQty: '', unitCost: '' };

/** A blank price is a free drink, as it was when the field was a number input. */
export function formPriceCents(form: DrinkForm): number {
  return parseMoneyInput(form.price) ?? 0;
}

export function calcCostCents(ingredients: IngForm[], inventory: InventoryRow[]): number {
  return recipeCostCents(
    ingredients.map((ing) => ({ item_id: ing.itemId, qty_used: parseFloat(ing.qtyUsed) || 0 })),
    inventory,
  );
}

/** What one pour of the form's drink costs: the stock item's unit cost, or the recipe's. */
export function formCostCents(form: DrinkForm, inventory: InventoryRow[]): number {
  if (form.trackStock) return parseMoneyInput(form.unitCost) ?? 0;
  return calcCostCents(form.ingredients, inventory);
}

// Priced as 0011 create_order prices a pour: the live recipe, or the stored estimate for a
// drink with no recipe, which is the only cost such a drink has.
export function liveCostCents(drink: DrinkWithIngredients, inventory: InventoryRow[]): number {
  if (drink.ingredients.length === 0) return drink.cost_estimate_cents;
  return recipeCostCents(drink.ingredients, inventory);
}

/** "Margin 62%", or null for a free drink, where a margin means nothing. */
export function marginLabel(priceCentsValue: number, costCents: number): string | null {
  if (priceCentsValue <= 0) return null;
  return `Margin ${Math.round(((priceCentsValue - costCents) / priceCentsValue) * 100)}%`;
}

/** A drink that costs something and sells for no more than that. A free, costless drink is not a loss. */
export function isLossMaking(priceCentsValue: number, costCents: number): boolean {
  return costCents > 0 && priceCentsValue <= costCents;
}

// The cost estimate is stored in whole cents; recipeCostCents is fractional (a recipe
// uses fractional quantities), so it rounds here, once, the way the import rounds the
// same figure (H5: half away from zero, which Math.round is for a non-negative cost).
// After 0011 a pour prices the live recipe instead, and this stored figure is only the
// fallback for a drink with no recipe — it is still written on every save.
export function buildDrink(form: DrinkForm, inventory: InventoryRow[]): DrinkFields {
  const ingredients = form.ingredients
    .filter((i) => i.itemId && i.qtyUsed)
    .map((i) => ({ itemId: i.itemId, qtyUsed: parseFloat(i.qtyUsed) }));
  return {
    name: form.name.trim(),
    priceCents: formPriceCents(form),
    costEstimateCents: Math.round(calcCostCents(form.ingredients, inventory)),
    ingredients,
  };
}

export function buildSimpleDrink(form: DrinkForm): SimpleDrinkFields {
  return {
    name: form.name.trim(),
    priceCents: formPriceCents(form),
    qtyOnHand: Math.max(0, parseFloat(form.stockQty) || 0),
    costPerUnitCents: parseMoneyInput(form.unitCost) ?? 0,
  };
}

/** Cents back to what a person would have typed: `500` is `5`, `550` is `5.50`. */
function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : formatCents(cents);
}

export function drinkToForm(drink: DrinkWithIngredients): DrinkForm {
  return {
    ...EMPTY_DRINK,
    name: drink.name,
    price: centsToInput(drink.price_cents),
    ingredients: drink.ingredients.map((i) => ({ itemId: i.item_id, qtyUsed: String(i.qty_used) })),
  };
}

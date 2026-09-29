import type { InventoryRow } from '@/lib/supabase/queries';

// The add form offers only these (0001's category check allows no others today). Grouping
// still renders anything else under OTHER, so a category added in the database without a
// screen change is never silently hidden.
export const CATEGORIES = ['Spirit', 'Mixer', 'Syrup', 'Garnish', 'Equipment'] as const;
const OTHER = 'Other';

export function groupByCategory(items: InventoryRow[]): [string, InventoryRow[]][] {
  const known: readonly string[] = CATEGORIES;
  const groups = CATEGORIES.map((cat): [string, InventoryRow[]] => [cat, items.filter((i) => i.category === cat)]);
  groups.push([OTHER, items.filter((i) => !known.includes(i.category))]);
  return groups.filter(([, rows]) => rows.length > 0);
}

/** A threshold of 0 means the host is not tracking that item, so it never runs low. */
export function isRunningLow(item: InventoryRow): boolean {
  return item.reorder_threshold > 0 && item.qty_on_hand <= item.reorder_threshold;
}

/** Enough to get back to twice the reorder point. */
export function suggestedBuy(item: InventoryRow): number {
  return Math.max(0, 2 * item.reorder_threshold - item.qty_on_hand);
}

/** Quantities are numeric(12,3); float arithmetic on them can print 0.30000000000000004. */
export function formatQty(qty: number): string {
  return String(Number(qty.toFixed(3)));
}

// A count of whole things needs no unit in the list: "Limes (×6)", not "Limes (each ×6)".
const COUNT_UNITS = new Set(['', 'each', 'ea', 'x', 'unit', 'units', 'pc', 'pcs']);

function listEntry(item: InventoryRow): string {
  const qty = `×${formatQty(suggestedBuy(item))}`;
  const unit = item.unit.trim();
  return `${item.name} (${COUNT_UNITS.has(unit.toLowerCase()) ? qty : `${unit} ${qty}`})`;
}

/** What "Copy list" puts on the clipboard, e.g. "Need: Vodka (750 ml ×2), Limes (×6)". */
export function shoppingListText(low: InventoryRow[]): string {
  return `Need: ${low.map(listEntry).join(', ')}`;
}

/**
 * The item already using this name, if any. No unique constraint guards inventory names
 * (0001 has none), so this is the only thing stopping two "Vodka" rows that recipes and
 * the shopping list could not tell apart.
 */
export function nameClash(items: InventoryRow[], name: string, exceptId?: string): InventoryRow | undefined {
  const wanted = name.trim().toLowerCase();
  return items.find((i) => i.id !== exceptId && i.name.trim().toLowerCase() === wanted);
}

/** A typed quantity: blank is `null`; anything that is not a non-negative number is `NaN`. */
export function parseQty(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const qty = Number(trimmed);
  return Number.isFinite(qty) && qty >= 0 ? qty : NaN;
}

// Money crosses every boundary in this package as integer cents. The Go models used
// float64 for every amount (backend/models/barModels.go:22-24), which for a ledger
// that settles real debts produces balances that never reconcile — the reason the
// schema states the rule in its own header (supabase/migrations/0001_init.sql:5-6).

/**
 * Convert a dollars-and-cents number to integer cents.
 *
 * Uses `Math.round`, which breaks ties toward positive infinity rather than away
 * from zero — so `toCents(-0.005)` is `-0`, not `-1`. That is deliberate: it is the
 * rule the one-shot Mongo import uses, and the two must agree exactly or imported
 * balances will not match the balances they were imported from.
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Render integer cents for display: `1234` becomes `"12.34"`. */
export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Cents as a plain dollar number, for the few display surfaces whose own format is not
 * `formatCents`'s: a chart axis that picks its own ticks (`$20`, not `$20.00`), a form
 * input prefilled with what the user would have typed (`25`, not `25.00`), and the legacy
 * dollar-denominated request bodies phase 6 replaces. The input need not be a whole
 * number — a recipe's cost estimate is fractional cents before it is ever stored
 * (`recipeCostCents`) — this only ever divides, it never rounds. **Never for arithmetic**
 * — sum and compare in cents first, convert once at the edge.
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

import { toCents } from '@pb/core';

// H5: one rounding rule does not fit every Mongo number. Which rule applies depends on
// how the value was produced, so each field is assigned one deliberately in
// transform.ts rather than everything going through a single helper.

/**
 * Money a human typed as dollars and cents — buy-ins, cash-outs, payments, drink
 * prices (parseFloat in the web forms). `toCents` is the rule phase 2 characterized
 * (`toCents(1.005)` is 100) and must be used here unchanged, or imported balances will
 * not match the balances they came from. `+ 0` turns `-0` into `0`.
 */
export function typedCents(dollars: number): number {
  return toCents(dollars) + 0;
}

// Arithmetic leaves noise in the last few bits: 1.5 * 0.85 is stored as
// 1.2749999999999999, and Math.round then lands on the wrong side of the half-cent.
// Twelve significant digits is far above any real price or stock level and far below
// the ~16 a double carries, so this recovers the value the arithmetic meant.
function snap(value: number): number {
  return Number(value.toPrecision(12));
}

function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value)) + 0;
}

/**
 * Money that was computed, not typed — `costEstimate` is sum(qtyUsed * costPerUnit)
 * (web/app/drinks/page.tsx:22) and is copied onto every order. It feeds no balance,
 * only the margin screens, so it gets the arithmetic's intended value rounded half away
 * from zero rather than `toCents`' float-exact tie behaviour.
 */
export function computedCents(dollars: number): number {
  return roundHalfAwayFromZero(snap(dollars * 100));
}

/**
 * A numeric(12,3) quantity. `qtyOnHand` is `$inc`'d on every pour and restore
 * (backend/handlers/orders.go:125,225), so it drifts like computed money; recipe
 * quantities and thresholds are typed. Both snap the same way, to three decimals. The
 * returned number serializes to JSON as the exact decimal Postgres will store.
 */
export function quantity(value: number): number {
  return roundHalfAwayFromZero(snap(value * 1000)) / 1000;
}

export function hasSubCent(dollars: number): boolean {
  return !Number.isInteger(snap(dollars * 100));
}

export function hasSubThousandth(value: number): boolean {
  return !Number.isInteger(snap(value * 1000));
}

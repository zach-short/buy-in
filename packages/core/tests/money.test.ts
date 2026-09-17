import { describe, expect, it } from 'vitest';

import { formatCents, toCents } from '../src/money';

describe('toCents', () => {
  it('converts typed dollars-and-cents exactly', () => {
    expect(toCents(12)).toBe(1200);
    expect(toCents(8.5)).toBe(850);
    expect(toCents(11.25)).toBe(1125);
    expect(toCents(0.05)).toBe(5);
  });

  it('survives the float representations that made the old ledger drift', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(10.1 + 20.2)).toBe(3030);
    // 1.005 is the one everybody expects to be 101. It is 100, because 1.005 is
    // stored as 1.00499999999999989... so 1.005 * 100 is 100.49999999999999 — below
    // the midpoint, so Math.round goes down. This is not a defect to fix here: it is
    // the rule the import must use identically (DESIGN.md D9), and the reason H5 says
    // a computed value needs checking separately from a typed one.
    expect(1.005 * 100).toBe(100.49999999999999);
    expect(toCents(1.005)).toBe(100);
  });

  it('breaks ties toward positive infinity — when the tie is really a tie', () => {
    // Math.round, not round-half-away-from-zero. Documented because the Mongo import
    // must use the identical rule or imported balances will not match their source.
    // Note 0.005 * 100 lands just ABOVE the midpoint where 1.005 * 100 landed below,
    // which is exactly why "round half up" is the wrong mental model for float money.
    expect(toCents(0.005)).toBe(1);
    expect(Object.is(toCents(-0.005), -0)).toBe(true);
    expect(toCents(-0.015)).toBe(-1);
  });
});

describe('formatCents', () => {
  it('renders two decimals, matching the toFixed(2) the receipts used', () => {
    expect(formatCents(1234)).toBe('12.34');
    expect(formatCents(4000)).toBe('40.00');
    expect(formatCents(5)).toBe('0.05');
    expect(formatCents(0)).toBe('0.00');
  });

  it('round-trips every typed amount it will ever see', () => {
    for (const dollars of [0, 0.05, 1.5, 12.34, 99.99, 1234.56]) {
      expect(formatCents(toCents(dollars))).toBe(dollars.toFixed(2));
    }
  });
});

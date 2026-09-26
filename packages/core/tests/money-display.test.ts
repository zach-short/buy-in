import { describe, expect, it } from 'vitest';

import { centsToDollars, formatCents, toCents } from '../src/money';

// centsToDollars exists so phase 5 can move web/ onto integer cents without changing what
// any screen shows (DESIGN.md §8.2). Each case below is a render the pre-migration code
// produced from a float dollar amount, and must still produce from integer cents.
describe('centsToDollars', () => {
  it('prefills an input exactly as String(dollars) did — no forced decimals', () => {
    // session/[id]/page.tsx cash-out prefill and drinks/page.tsx drinkToForm both did
    // String(amount) on the Go API's float.
    expect(String(centsToDollars(2500))).toBe(String(25));
    expect(String(centsToDollars(2550))).toBe(String(25.5));
    expect(String(centsToDollars(1299))).toBe(String(12.99));
    expect(String(centsToDollars(5))).toBe(String(0.05));
  });

  it('agrees with formatCents wherever a caller still formats with toFixed(2)', () => {
    for (let cents = -2000; cents <= 200000; cents += 7) {
      expect(centsToDollars(cents).toFixed(2)).toBe(formatCents(cents));
    }
  });

  it('round-trips through toCents for every whole-cent amount', () => {
    for (let cents = 0; cents <= 200000; cents += 3) {
      expect(toCents(centsToDollars(cents))).toBe(cents);
    }
  });
});

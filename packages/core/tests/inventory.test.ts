import { describe, expect, it } from 'vitest';

import { canMake } from '../src/inventory';

const stock = [
  { id: 'gin', qtyOnHand: 25.5 },
  { id: 'tonic', qtyOnHand: 4 },
  { id: 'lime', qtyOnHand: 0 },
];

describe('canMake', () => {
  it('is true when every ingredient is in stock', () => {
    expect(canMake({ ingredients: [{ itemId: 'gin', qtyUsed: 2 }] }, stock)).toBe(true);
  });

  it('is true at exactly the quantity on hand', () => {
    expect(canMake({ ingredients: [{ itemId: 'tonic', qtyUsed: 4 }] }, stock)).toBe(true);
  });

  it('is false one unit over', () => {
    expect(canMake({ ingredients: [{ itemId: 'tonic', qtyUsed: 4.001 }] }, stock)).toBe(false);
  });

  it('is false for an item at zero', () => {
    expect(canMake({ ingredients: [{ itemId: 'lime', qtyUsed: 1 }] }, stock)).toBe(false);
  });

  it('is false for an item missing from inventory entirely', () => {
    expect(canMake({ ingredients: [{ itemId: 'absinthe', qtyUsed: 1 }] }, stock)).toBe(false);
  });

  it('is TRUE for a drink with no ingredients — `every` on an empty array', () => {
    // Preserved deliberately from bar-api.ts:106-109. A drink with no recipe shows on
    // the menu as available, which is what the menu does now.
    expect(canMake({ ingredients: [] }, stock)).toBe(true);
    expect(canMake({ ingredients: [] }, [])).toBe(true);
  });

  it('handles fractional quantities, which is why these are not cents', () => {
    expect(canMake({ ingredients: [{ itemId: 'gin', qtyUsed: 25.5 }] }, stock)).toBe(true);
    expect(canMake({ ingredients: [{ itemId: 'gin', qtyUsed: 25.75 }] }, stock)).toBe(false);
  });
});

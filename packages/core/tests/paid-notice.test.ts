import { describe, expect, it } from 'vitest';

import { paidNotice } from '../src/paid-notice';

describe('paidNotice', () => {
  it('names the amount paid, in dollars and cents', () => {
    expect(paidNotice(3800)).toBe('I paid my $38.00 balance at your table');
  });

  it('reads a part payment as what was sent', () => {
    expect(paidNotice(1750)).toBe('I paid my $17.50 balance at your table');
  });

  it('ignores the sign, so a balance read the other way round still reads as a payment', () => {
    expect(paidNotice(-3800)).toBe('I paid my $38.00 balance at your table');
  });
});

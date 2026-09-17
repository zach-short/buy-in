import { describe, expect, it } from 'vitest';

import { venmoNote, venmoTxnFor, venmoUrls } from '../src/venmo';

// Characterization against the three builders that shipped, all read at 2026-09-16:
//   A. web/lib/bar-api.ts:111-118          — pay, note 'poker', recipient = player
//   B. player-receipt/…/page.tsx:85-102    — pay or charge by sign, note 'poker'
//   C. receipt-ui.tsx:54-72                — pay, note = session name
// The note changes by decision (D12). The URL *shapes* must not, so they are pinned
// here: a receipt deep link that stops opening Venmo is a failure nobody sees in CI.

describe('venmoUrls preserves the URL shapes that shipped', () => {
  it('builds the pay shape byte for byte, given the old note', () => {
    const { deepLink, webUrl } = venmoUrls('@zach', 4250, 'poker');
    expect(deepLink).toBe('venmo://paycharge?txn=pay&recipients=zach&amount=42.50&note=poker');
    expect(webUrl).toBe('https://account.venmo.com/pay?recipients=zach&amount=42.50&note=poker');
  });

  it('builds the charge shape, including txn=charge on the web URL only', () => {
    const { deepLink, webUrl } = venmoUrls('zach', -1999, 'poker', 'charge');
    expect(deepLink).toBe('venmo://paycharge?txn=charge&recipients=zach&amount=19.99&note=poker');
    expect(webUrl).toBe('https://account.venmo.com/pay?txn=charge&recipients=zach&amount=19.99&note=poker');
  });

  it('strips exactly one leading @, like every builder it replaces', () => {
    expect(venmoUrls('@zach', 100, 'x').deepLink).toContain('recipients=zach&');
    expect(venmoUrls('zach', 100, 'x').deepLink).toContain('recipients=zach&');
  });

  it('always sends a positive amount, whichever direction the money runs', () => {
    expect(venmoUrls('zach', -1999, 'x', 'charge').deepLink).toContain('amount=19.99');
    expect(venmoUrls('zach', 1999, 'x').deepLink).toContain('amount=19.99');
  });

  it('formats whole dollars with two decimals, as toFixed(2) did', () => {
    expect(venmoUrls('zach', 4000, 'x').deepLink).toContain('amount=40.00');
    expect(venmoUrls('zach', 5, 'x').deepLink).toContain('amount=0.05');
  });

  it('encodes the note, which now contains a space and an em dash', () => {
    const { deepLink } = venmoUrls('zach', 100, venmoNote('Friday Night'));
    expect(deepLink).toContain('note=Poker%20Bar%20%E2%80%94%20Friday%20Night');
  });
});

describe('venmoNote and venmoTxnFor', () => {
  it('uses the plain register chosen at GATE 1', () => {
    expect(venmoNote('Friday Night')).toBe('Poker Bar — Friday Night');
  });

  it('pays when the player owes and charges when the house owes', () => {
    // The house convention: positive means the player owes (balance.ts).
    expect(venmoTxnFor(2500)).toBe('pay');
    expect(venmoTxnFor(-2500)).toBe('charge');
  });

  it('charges on a zero balance, matching the old if/else that had no zero branch', () => {
    // player-receipt/…/page.tsx:88 tested `balance > 0`, so zero fell to the charge
    // branch. Preserved rather than "fixed": a zero-balance receipt should not offer
    // a payment at all, and that is a screen decision, not this function's.
    expect(venmoTxnFor(0)).toBe('charge');
  });
});

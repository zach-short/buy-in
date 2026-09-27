import { describe, expect, it } from 'vitest';

import { DEFAULT_VENMO_NOTE, renderVenmoNote } from '../src/venmo-note';

// The owner's rule, 2026-09-27: the default note is `Buy-In`, and the balance never
// appears in a Venmo note unless the host's own template asks for it.

describe('renderVenmoNote defaults', () => {
  it('is plain Buy-In with no template', () => {
    expect(DEFAULT_VENMO_NOTE).toBe('Buy-In');
    expect(renderVenmoNote(null, { amountCents: 4250 })).toBe('Buy-In');
    expect(renderVenmoNote(undefined, { amountCents: 4250, sessionName: 'Friday' })).toBe('Buy-In');
  });

  it('treats a blank or whitespace-only template as no template', () => {
    expect(renderVenmoNote('', { amountCents: 4250 })).toBe('Buy-In');
    expect(renderVenmoNote('   \n ', { amountCents: 4250 })).toBe('Buy-In');
  });

  it('falls back to the default when everything in the template collapses away', () => {
    expect(renderVenmoNote('{{session}}', { amountCents: 100 })).toBe('Buy-In');
  });
});

describe('renderVenmoNote amount', () => {
  it('never shows the amount unless the template has the tag', () => {
    const note = renderVenmoNote('Poker night — {{session}}', { amountCents: 4250, sessionName: 'Friday' });
    expect(note).toBe('Poker night — Friday');
    expect(note).not.toContain('42.50');
  });

  it('formats the amount as dollars from cents, always positive', () => {
    expect(renderVenmoNote('Buy-In {{amount}}', { amountCents: 4250 })).toBe('Buy-In $42.50');
    expect(renderVenmoNote('Buy-In {{amount}}', { amountCents: -1999 })).toBe('Buy-In $19.99');
    expect(renderVenmoNote('{{amount}}', { amountCents: 5 })).toBe('$0.05');
  });

  it('accepts inner spaces and any case in a known tag', () => {
    expect(renderVenmoNote('Tab {{ AMOUNT }}', { amountCents: 4000 })).toBe('Tab $40.00');
  });
});

describe('renderVenmoNote session', () => {
  it('fills the session name when there is one', () => {
    expect(renderVenmoNote('Buy-In — {{session}}', { amountCents: 0, sessionName: 'Friday Night' }))
      .toBe('Buy-In — Friday Night');
  });

  it('drops the slot and its separator when there is no session', () => {
    expect(renderVenmoNote('Buy-In — {{session}}', { amountCents: 0 })).toBe('Buy-In');
    expect(renderVenmoNote('{{session}}: Buy-In', { amountCents: 0 })).toBe('Buy-In');
    expect(renderVenmoNote('Buy-In — {{session}} — {{amount}}', { amountCents: 1200 })).toBe('Buy-In — $12.00');
    expect(renderVenmoNote('Buy-In {{session}} tab', { amountCents: 0, sessionName: '  ' })).toBe('Buy-In tab');
  });

  it('does not expand a tag that arrives inside the session name', () => {
    expect(renderVenmoNote('{{session}}', { amountCents: 100, sessionName: '{{amount}}' })).toBe('{{amount}}');
  });
});

describe('renderVenmoNote unknown tags and whitespace', () => {
  it('leaves an unknown tag literal so a typo shows in the preview', () => {
    expect(renderVenmoNote('Buy-In {{amout}}', { amountCents: 100 })).toBe('Buy-In {{amout}}');
  });

  it('trims and collapses whitespace, including newlines', () => {
    expect(renderVenmoNote('  Buy-In \n  {{amount}}  ', { amountCents: 100 })).toBe('Buy-In $1.00');
  });
});

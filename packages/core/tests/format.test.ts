import { describe, expect, it } from 'vitest';

import { formatDate, formatTime } from '../src/format';

// These read the host timezone, so vitest.config.ts pins TZ to America/New_York.
// Without that pin these assertions pass or fail depending on the machine, which is
// worse than having no test at all.

describe('formatDate', () => {
  it('renders the long-month form the receipts already show', () => {
    expect(formatDate('2026-09-16T20:00:00Z')).toBe('September 16, 2026');
  });

  // ── A live defect, characterized rather than fixed. ────────────────────────────
  // A bare 'YYYY-MM-DD' is parsed as UTC midnight (ECMA-262 date-only forms are UTC),
  // then rendered in the viewer's zone — so west of UTC it shows the DAY BEFORE.
  //
  // This is not hypothetical for the migration. `sessions.played_on` is a `date`
  // column (supabase/migrations/0001_init.sql) and PostgREST serializes a date as a
  // bare 'YYYY-MM-DD', so every session would render one day early for the owner, who
  // is in America/New_York. It is one reason BD-2 makes `played_on` a `timestamptz`;
  // it is NOT fixed by BD-2 alone, because any other bare date reaching this function
  // has the same problem.
  //
  // Preserved here as the current behaviour because changing how a date reads is a
  // screen change (DESIGN.md §8.2) and therefore the owner's call, not this phase's.
  it('renders a bare date string one day early, west of UTC (KNOWN DEFECT)', () => {
    expect(formatDate('2026-01-02')).toBe('January 1, 2026');
  });

  it('renders the intended day when the string carries a local time', () => {
    expect(formatDate('2026-01-02T00:00:00')).toBe('January 2, 2026');
  });

  it('renders the intended day when the string carries a zone', () => {
    expect(formatDate('2026-01-02T12:00:00Z')).toBe('January 2, 2026');
  });
});

describe('formatTime', () => {
  it('renders 12-hour time with a padded minute', () => {
    expect(formatTime('2026-09-16T20:05:00Z')).toBe('4:05 PM');
  });

  it('pads the minute but not the hour', () => {
    expect(formatTime('2026-09-16T13:00:00Z')).toBe('9:00 AM');
  });
});

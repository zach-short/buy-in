import { describe, expect, it } from 'vitest';

import {
  centsPerHour,
  filterResults,
  formatBlinds,
  hoursToMinutes,
  mergeResults,
  playedOnFromLocalDate,
  resultsFromLogged,
  resultsFromPerformance,
  type LoggedLike,
  type PerformanceLike,
} from '../src/logged-session';

function logged(overrides: Partial<LoggedLike>): LoggedLike {
  return {
    id: 'l1',
    played_on: '2026-09-20T16:00:00Z',
    venue: 'Rivers Casino',
    small_blind_cents: 200,
    big_blind_cents: 500,
    straddle_cents: null,
    game_format: null,
    buy_in_cents: 30000,
    cash_out_cents: 50000,
    minutes_played: 240,
    note: null,
    ...overrides,
  };
}

function home(overrides: Partial<PerformanceLike>): PerformanceLike {
  return {
    bar_id: 'b1',
    bar_name: "Colin's",
    session_id: 's1',
    session_name: 'Friday',
    played_on: '2026-09-19T00:00:00Z',
    stakes_cents: 2000,
    net_cents: -5000,
    ...overrides,
  };
}

describe('resultsFromLogged', () => {
  it('nets cash-out minus buy-in, won-positive: in $300, out $500 is +$200', () => {
    expect(resultsFromLogged([logged({})])[0].netCents).toBe(20000);
  });

  it('a bust is a loss of the whole buy-in', () => {
    expect(resultsFromLogged([logged({ cash_out_cents: 0 })])[0].netCents).toBe(-30000);
  });

  it('carries the venue as the place and the blinds and hours through', () => {
    const [row] = resultsFromLogged([logged({ straddle_cents: 1000, game_format: 'NLH' })]);
    expect(row).toMatchObject({
      source: 'logged', id: 'l1', place: 'Rivers Casino',
      smallBlindCents: 200, bigBlindCents: 500, straddleCents: 1000, gameFormat: 'NLH', minutes: 240,
    });
  });
});

describe('resultsFromPerformance', () => {
  it('keeps the RPC sign as it is and names the table', () => {
    expect(resultsFromPerformance([home({})])[0]).toEqual({
      source: 'home', id: 's1', place: "Colin's", playedOn: '2026-09-19T00:00:00Z',
      netCents: -5000, barId: 'b1', sessionName: 'Friday', stakesCents: 2000,
    });
  });
});

describe('mergeResults', () => {
  it('orders both sources oldest first', () => {
    const merged = mergeResults(
      resultsFromPerformance([home({ session_id: 's1', played_on: '2026-09-01T00:00:00Z' }), home({ session_id: 's2', played_on: '2026-09-30T00:00:00Z' })]),
      resultsFromLogged([logged({ id: 'l1', played_on: '2026-09-15T16:00:00Z' })]),
    );
    expect(merged.map((row) => row.id)).toEqual(['s1', 'l1', 's2']);
  });

  it('breaks a same-instant tie by id, so the running total takes one path', () => {
    const at = '2026-09-15T16:00:00Z';
    const merged = mergeResults(
      resultsFromPerformance([home({ session_id: 'b', played_on: at })]),
      resultsFromLogged([logged({ id: 'a', played_on: at })]),
    );
    expect(merged.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('sums to the combined P&L: -$50 at home and +$200 logged is +$150', () => {
    const merged = mergeResults(resultsFromPerformance([home({})]), resultsFromLogged([logged({})]));
    expect(merged.reduce((sum, row) => sum + row.netCents, 0)).toBe(15000);
  });
});

describe('filterResults', () => {
  const rows = mergeResults(
    resultsFromPerformance([home({ session_id: 's1', bar_id: 'b1' }), home({ session_id: 's2', bar_id: 'b2' })]),
    resultsFromLogged([logged({ id: 'l1' })]),
  );
  const ids = (source: 'all' | 'home' | 'logged', table: string | null) =>
    filterResults(rows, { source, table }).map((row) => row.id).sort();

  it('all keeps every row', () => expect(ids('all', null)).toEqual(['l1', 's1', 's2']));
  it('home keeps table games only', () => expect(ids('home', null)).toEqual(['s1', 's2']));
  it('logged keeps logged games only', () => expect(ids('logged', null)).toEqual(['l1']));

  it('a table means that table’s home games, whatever the source says', () => {
    expect(ids('all', 'b1')).toEqual(['s1']);
    expect(ids('logged', 'b1')).toEqual(['s1']);
  });
});

describe('centsPerHour', () => {
  it('+$200 over 4 hours is $50/hr', () => expect(centsPerHour(20000, 240)).toBe(5000));
  it('keeps the sign of a loss', () => expect(centsPerHour(-9000, 180)).toBe(-3000));
  it('rounds to the cent', () => expect(centsPerHour(10000, 70)).toBe(8571));
  it('is null without hours', () => {
    expect(centsPerHour(20000, null)).toBeNull();
    expect(centsPerHour(20000, 0)).toBeNull();
  });
});

describe('formatBlinds', () => {
  it('whole-dollar blinds drop the cents', () => expect(formatBlinds(200, 500, null)).toBe('$2/$5'));
  it('part-dollar blinds keep them', () => expect(formatBlinds(25, 50, null)).toBe('$0.25/$0.50'));
  it('a straddle is a third figure', () => expect(formatBlinds(200, 500, 1000)).toBe('$2/$5/$10'));
});

describe('hoursToMinutes', () => {
  it('blank is empty, not zero', () => {
    expect(hoursToMinutes('', 48)).toEqual({ kind: 'empty' });
    expect(hoursToMinutes('   ', 48)).toEqual({ kind: 'empty' });
  });
  it('4.5 hours is 270 minutes', () => expect(hoursToMinutes('4.5', 48)).toEqual({ kind: 'minutes', minutes: 270 }));
  it('accepts a leading dot', () => expect(hoursToMinutes('.5', 48)).toEqual({ kind: 'minutes', minutes: 30 }));
  it('accepts the cap itself', () => expect(hoursToMinutes('48', 48)).toEqual({ kind: 'minutes', minutes: 2880 }));
  it.each(['0', '-1', '48.01', '300', 'abc', '4.5h', '1e2'])('refuses %s', (text) => {
    expect(hoursToMinutes(text, 48)).toEqual({ kind: 'invalid' });
  });
});

// vitest.config.ts pins TZ to America/New_York, so this proves the rule at one US offset (-4 in
// September). Noon keeps the day for any offset within ±11 hours; that part is arithmetic, not
// something a single-zone run can show.
describe('playedOnFromLocalDate', () => {
  it('is local noon of the picked day', () => {
    const played = new Date(playedOnFromLocalDate('2026-09-28'));
    expect([played.getFullYear(), played.getMonth() + 1, played.getDate(), played.getHours()]).toEqual([2026, 9, 28, 12]);
  });

  it('stays the same calendar day in UTC too, unlike a bare date', () => {
    expect(playedOnFromLocalDate('2026-09-28').slice(0, 10)).toBe('2026-09-28');
    expect(new Date('2026-09-28').getDate()).toBe(27);
  });

  it.each(['2026-02-30', '2026-13-01', '28/09/2026', ''])('refuses %s', (day) => {
    expect(() => playedOnFromLocalDate(day)).toThrow();
  });
});

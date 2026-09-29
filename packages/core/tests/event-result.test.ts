import { describe, expect, it } from 'vitest';

import {
  breakdownByType,
  eventDetail,
  eventNetCents,
  filterByType,
  mergeEverything,
  rowsFromEvents,
  rowsFromPoker,
  typeChips,
  type EventLike,
  type EverythingRow,
} from '../src/event-result';
import type { HomeResult, LoggedResult } from '../src/logged-session';

function event(overrides: Partial<EventLike>): EventLike {
  return {
    id: 'e1',
    event_type: 'sports_betting',
    played_on: '2026-09-20T16:00:00Z',
    place: 'DraftKings',
    title: null,
    stake_cents: 11000,
    payout_cents: 21000,
    minutes_played: null,
    note: null,
    details: {},
    ...overrides,
  };
}

function homeGame(overrides: Partial<HomeResult>): HomeResult {
  return {
    source: 'home', id: 's1', place: "Colin's", playedOn: '2026-09-19T00:00:00Z', netCents: -5000,
    barId: 'b1', sessionName: 'Friday', stakesCents: 2000, ...overrides,
  };
}

function loggedGame(overrides: Partial<LoggedResult>): LoggedResult {
  return {
    source: 'logged', id: 'l1', place: 'Rivers Casino', playedOn: '2026-09-21T16:00:00Z', netCents: 20000,
    smallBlindCents: 200, bigBlindCents: 500, straddleCents: null, gameFormat: null, minutes: 240, ...overrides,
  };
}

const detailStub = (row: HomeResult | LoggedResult) => `detail:${row.id}`;

function net(rows: readonly EverythingRow[]): number {
  return rows.reduce((sum, row) => sum + row.netCents, 0);
}

describe('eventNetCents — payout minus stake, won-positive (SCOPE H1)', () => {
  it('put in 10, got back 20 is +10', () => {
    expect(eventNetCents(1000, 2000)).toBe(1000);
  });

  it('put in 25, got back 0 is -25', () => {
    expect(eventNetCents(2500, 0)).toBe(-2500);
  });

  it('put in 10, got back 10 is even', () => {
    expect(eventNetCents(1000, 1000)).toBe(0);
  });

  it('a free bet, in 0, back 25, is +25', () => {
    expect(eventNetCents(0, 2500)).toBe(2500);
  });
});

describe('rowsFromEvents', () => {
  it('nets each row the player\'s way round and keys it apart from poker', () => {
    const [row] = rowsFromEvents([event({})]);
    expect(row).toEqual({
      key: 'event:e1', type: 'sports_betting', place: 'DraftKings', playedOn: '2026-09-20T16:00:00Z',
      netCents: 10000, detail: '', href: '/results/event/e1', minutes: null,
    });
  });

  it('keeps a slug the registry no longer knows, and counts it (SCOPE H5)', () => {
    const [row] = rowsFromEvents([event({ event_type: 'horse_racing', details: { horse: 'Seabiscuit' } })]);
    expect(row).toMatchObject({ type: 'horse_racing', netCents: 10000, detail: '' });
  });

  it('carries minutes through where a type records hours', () => {
    const [row] = rowsFromEvents([event({ event_type: 'blackjack', minutes_played: 90 })]);
    expect(row.minutes).toBe(90);
  });
});

describe('rowsFromPoker', () => {
  it('a home game is inert, a logged game links to its edit page', () => {
    const [home, logged] = rowsFromPoker([homeGame({}), loggedGame({})], detailStub);
    expect(home).toMatchObject({ key: 'home:s1', type: 'poker', netCents: -5000, href: null, minutes: null, detail: 'detail:s1' });
    expect(logged).toMatchObject({ key: 'logged:l1', type: 'poker', netCents: 20000, href: '/results/log/l1', minutes: 240 });
  });

  it('does not re-sign poker: its net is already won-positive', () => {
    const [row] = rowsFromPoker([loggedGame({ netCents: -1234 })], detailStub);
    expect(row.netCents).toBe(-1234);
  });
});

describe('eventDetail', () => {
  it('a sports bet reads sport · bet type · odds', () => {
    expect(eventDetail(event({ details: { sport: 'NFL', betType: 'spread', americanOdds: -110 } }))).toBe('NFL · spread · -110');
  });

  it('positive odds carry their plus sign', () => {
    expect(eventDetail(event({ details: { americanOdds: 150 } }))).toBe('+150');
  });

  it('blackjack reads its table minimum in whole dollars', () => {
    expect(eventDetail(event({ event_type: 'blackjack', details: { tableMinCents: 2500 } }))).toBe('$25 min');
    expect(eventDetail(event({ event_type: 'blackjack', details: { tableMinCents: 250 } }))).toBe('$2.50 min');
  });

  it('a type with no extras reads nothing', () => {
    expect(eventDetail(event({ event_type: 'slots' }))).toBe('');
  });

  it('a title leads the line', () => {
    expect(eventDetail(event({ event_type: 'other', title: 'Horse racing' }))).toBe('Horse racing');
    expect(eventDetail(event({ title: 'Sunday slate', details: { sport: 'NFL' } }))).toBe('Sunday slate · NFL');
  });

  it('a malformed details renders the base row, never throws (SCOPE H4)', () => {
    expect(eventDetail(event({ details: [] }))).toBe('');
    expect(eventDetail(event({ details: { americanOdds: 'minus 110' } }))).toBe('');
    expect(eventDetail(event({ title: 'Kept', details: { americanOdds: 5 } }))).toBe('Kept');
  });
});

describe('mergeEverything', () => {
  it('interleaves poker and events oldest first', () => {
    const poker = rowsFromPoker([homeGame({ playedOn: '2026-09-19T00:00:00Z' }), loggedGame({ playedOn: '2026-09-21T16:00:00Z' })], detailStub);
    const events = rowsFromEvents([event({ id: 'e1', played_on: '2026-09-20T16:00:00Z' }), event({ id: 'e2', played_on: '2026-09-22T16:00:00Z' })]);
    expect(mergeEverything(poker, events).map((row) => row.key)).toEqual(['home:s1', 'event:e1', 'logged:l1', 'event:e2']);
  });

  it('breaks a same-instant tie by key, so the running total\'s path is stable', () => {
    const instant = '2026-09-20T16:00:00Z';
    const poker = rowsFromPoker([loggedGame({ id: 'l1', playedOn: instant }), homeGame({ id: 's1', playedOn: instant })], detailStub);
    const events = rowsFromEvents([event({ id: 'e2', played_on: instant }), event({ id: 'e1', played_on: instant })]);
    const keys = ['event:e1', 'event:e2', 'home:s1', 'logged:l1'];
    expect(mergeEverything(poker, events).map((row) => row.key)).toEqual(keys);
    expect(mergeEverything(events, poker).map((row) => row.key)).toEqual(keys);
  });

  it('compares instants, not strings: an offset timestamp sorts by its real time', () => {
    const events = rowsFromEvents([
      event({ id: 'late', played_on: '2026-09-20T12:00:00-04:00' }),
      event({ id: 'early', played_on: '2026-09-20T15:00:00Z' }),
    ]);
    expect(mergeEverything([], events).map((row) => row.key)).toEqual(['event:early', 'event:late']);
  });
});

describe('filterByType, typeChips, breakdownByType', () => {
  const rows = mergeEverything(
    rowsFromPoker([homeGame({ netCents: -5000 }), loggedGame({ netCents: 20000 })], detailStub),
    rowsFromEvents([
      event({ id: 'e1', stake_cents: 11000, payout_cents: 21000 }),
      event({ id: 'e2', event_type: 'blackjack', stake_cents: 4000, payout_cents: 0 }),
      event({ id: 'e3', event_type: 'horse_racing', stake_cents: 1000, payout_cents: 3000 }),
    ]),
  );

  it('all returns every row', () => {
    expect(filterByType(rows, 'all')).toHaveLength(5);
  });

  it('poker covers both poker sources', () => {
    const poker = filterByType(rows, 'poker');
    expect(poker.map((row) => row.key)).toEqual(['home:s1', 'logged:l1']);
    expect(net(poker)).toBe(15000);
  });

  it('a type keeps only its own rows', () => {
    expect(net(filterByType(rows, 'sports_betting'))).toBe(10000);
  });

  it('chips list only present types: poker first, registry order, then unknown slugs', () => {
    expect(typeChips(rows)).toEqual([
      { slug: 'poker', label: 'Poker' },
      { slug: 'blackjack', label: 'Blackjack' },
      { slug: 'sports_betting', label: 'Sports betting' },
      { slug: 'horse_racing', label: 'Horse racing' },
    ]);
  });

  it('no poker chip without poker rows', () => {
    expect(typeChips(rowsFromEvents([event({})])).map((chip) => chip.slug)).toEqual(['sports_betting']);
  });

  it('no chips for no rows', () => {
    expect(typeChips([])).toEqual([]);
  });

  it('the breakdown sums to the merged total, unknown slugs included', () => {
    const breakdown = breakdownByType(rows);
    expect(breakdown).toEqual([
      { slug: 'poker', label: 'Poker', netCents: 15000, entries: 2 },
      { slug: 'blackjack', label: 'Blackjack', netCents: -4000, entries: 1 },
      { slug: 'sports_betting', label: 'Sports betting', netCents: 10000, entries: 1 },
      { slug: 'horse_racing', label: 'Horse racing', netCents: 2000, entries: 1 },
    ]);
    expect(breakdown.reduce((sum, type) => sum + type.netCents, 0)).toBe(net(rows));
    expect(net(rows)).toBe(23000);
  });
});

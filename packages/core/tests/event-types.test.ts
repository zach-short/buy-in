import { describe, expect, it } from 'vitest';

import {
  EVENT_SLUG,
  EVENT_TYPES,
  POKER_TYPE,
  eventType,
  parseAmericanOdds,
  parseEventDetails,
  searchEventTypes,
  typeLabel,
} from '../src/event-types';

// The database's slug check, copied from 0027_logged_events.sql. If the migration's regex
// changes, this line and EVENT_SLUG change with it (log-events PLAN.md BD-9).
const DB_SLUG = /^[a-z][a-z0-9_]{0,39}$/;

describe('the registry', () => {
  it('has no duplicate slug', () => {
    const slugs = EVENT_TYPES.map((type) => type.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every slug passes the database check', () => {
    for (const type of EVENT_TYPES) expect(type.slug).toMatch(DB_SLUG);
  });

  it('mirrors the database regex exactly', () => {
    expect(EVENT_SLUG.source).toBe(DB_SLUG.source);
  });

  it('never holds poker: poker lives in logged_sessions (SCOPE H3)', () => {
    expect(EVENT_TYPES.map((type) => type.slug)).not.toContain(POKER_TYPE);
    expect(eventType(POKER_TYPE)).toBeUndefined();
  });

  it('ships the SCOPE K4(a) list, in order', () => {
    expect(EVENT_TYPES.map((type) => type.slug)).toEqual([
      'blackjack', 'sports_betting', 'slots', 'roulette', 'craps', 'baccarat', 'lottery', 'other',
    ]);
  });

  it('every type accepts empty details: every extra is optional', () => {
    for (const type of EVENT_TYPES) expect(type.details.safeParse({}).success).toBe(true);
  });

  it('sports betting and lottery ask for no hours and make the place optional', () => {
    for (const slug of ['sports_betting', 'lottery']) {
      expect(eventType(slug)).toMatchObject({ asksHours: false, placeRequired: false });
    }
  });

  it('only Other requires a title', () => {
    expect(EVENT_TYPES.filter((type) => type.titleRequired).map((type) => type.slug)).toEqual(['other']);
  });

  it('uses the plain money labels the owner chose (SCOPE Q3)', () => {
    for (const type of EVENT_TYPES) {
      expect(type.inLabel).toBe('Put in');
      expect(type.outLabel).toBe('Got back (with your stake)');
    }
  });
});

describe('typeLabel', () => {
  it('names a registered type by its label', () => {
    expect(typeLabel('sports_betting')).toBe('Sports betting');
  });

  it('names poker, which is not a registry entry', () => {
    expect(typeLabel(POKER_TYPE)).toBe('Poker');
  });

  it('humanises a slug the registry no longer knows (SCOPE H5)', () => {
    expect(typeLabel('horse_racing')).toBe('Horse racing');
  });
});

describe('searchEventTypes', () => {
  it('lists poker first, then every registered type, for an empty query', () => {
    const slugs = searchEventTypes('  ').map((option) => option.slug);
    expect(slugs).toEqual([POKER_TYPE, ...EVENT_TYPES.map((type) => type.slug)]);
  });

  it('finds blackjack from "black", case-insensitively', () => {
    expect(searchEventTypes('Black').map((option) => option.slug)).toEqual(['blackjack']);
  });

  it('matches an alias', () => {
    expect(searchEventTypes('sportsbook').map((option) => option.slug)).toEqual(['sports_betting']);
    expect(searchEventTypes('holdem').map((option) => option.slug)).toEqual([POKER_TYPE]);
  });

  it('falls back to Other when nothing matches, never an empty list', () => {
    expect(searchEventTypes('blakjack').map((option) => option.slug)).toEqual(['other']);
  });
});

describe('parseAmericanOdds', () => {
  it('blank is empty, not zero', () => {
    expect(parseAmericanOdds('')).toEqual({ kind: 'empty' });
    expect(parseAmericanOdds('   ')).toEqual({ kind: 'empty' });
  });

  it.each([
    ['+150', 150],
    ['-110', -110],
    ['110', 110],
    ['100', 100],
    [' -250 ', -250],
  ])('%s is %i', (text, odds) => {
    expect(parseAmericanOdds(text)).toEqual({ kind: 'odds', odds });
  });

  it.each(['99', '0', '-99', '1.5', 'abc', '+-110', '-0', '1e3'])('%s is invalid', (text) => {
    expect(parseAmericanOdds(text)).toEqual({ kind: 'invalid' });
  });
});

describe('parseEventDetails', () => {
  it('reads a sports bet\'s extras', () => {
    expect(parseEventDetails('sports_betting', { sport: 'NFL', betType: 'spread', americanOdds: -110 }))
      .toEqual({ sport: 'NFL', betType: 'spread', americanOdds: -110 });
  });

  it('refuses odds the database would (abs below 100) and a float', () => {
    expect(parseEventDetails('sports_betting', { americanOdds: 99 })).toBeNull();
    expect(parseEventDetails('sports_betting', { americanOdds: -150.5 })).toBeNull();
  });

  it('refuses a table minimum that is not positive whole cents', () => {
    expect(parseEventDetails('blackjack', { tableMinCents: 0 })).toBeNull();
    expect(parseEventDetails('blackjack', { tableMinCents: 25.5 })).toBeNull();
    expect(parseEventDetails('blackjack', { tableMinCents: 2500 })).toEqual({ tableMinCents: 2500 });
  });

  it('is null for a malformed details, never a throw (SCOPE H4)', () => {
    expect(parseEventDetails('sports_betting', [])).toBeNull();
    expect(parseEventDetails('sports_betting', 'NFL')).toBeNull();
    expect(parseEventDetails('sports_betting', { sport: 42 })).toBeNull();
    expect(parseEventDetails('blackjack', null)).toBeNull();
  });

  it('is null for a slug the registry does not know', () => {
    expect(parseEventDetails('horse_racing', {})).toBeNull();
  });
});

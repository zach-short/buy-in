import { z } from 'zod';

// The event-type registry (log-events PLAN.md BD-7): the one place a type exists. A new type is
// an entry here, never a migration — logged_events stores the slug as text and checks only its
// format (SCOPE K1(a)). The database also refuses 'poker', which lives in logged_sessions (0021)
// and is offered by the picker as POKER_TYPE, not as an entry here (SCOPE H3).
//
// Three places state each rule and must agree (BD-9): the table's checks, these schemas, and
// the form in phase 2. event-types.test.ts pins the slug rule against the migration's regex.

/** Poker's slug in the picker and on the Everything tab. Never written to logged_events. */
export const POKER_TYPE = 'poker';

/** The table's slug check, verbatim. */
export const EVENT_SLUG = /^[a-z][a-z0-9_]{0,39}$/;

/** What one extra field holds, which decides its input in the form. */
export type ExtraKind = 'money' | 'text' | 'odds';

export interface ExtraField {
  key: keyof EventDetails;
  label: string;
  kind: ExtraKind;
}

/** Every extra any type stores in `details`; each type's schema allows only its own. */
export interface EventDetails {
  tableMinCents?: number;
  sport?: string;
  betType?: string;
  americanOdds?: number;
}

export interface EventType {
  slug: string;
  label: string;
  /** Other words a player might type for it in the picker. */
  search: readonly string[];
  extras: readonly ExtraField[];
  asksHours: boolean;
  placeRequired: boolean;
  placeLabel: string;
  titleRequired: boolean;
  inLabel: string;
  outLabel: string;
  details: z.ZodType<EventDetails, z.ZodTypeDef, unknown>;
}

/** One row of the type picker: a registered type, or poker. */
export interface TypeOption {
  slug: string;
  label: string;
}

// BD-8: American odds are whole numbers at least 100 either side of even. They are a note the
// player types, never an input to any sum (SCOPE §2).
const americanOdds = z.number().int().refine((odds) => Math.abs(odds) >= 100);
// A short free-text extra; 40 matches logged_sessions.game_format (0021).
const shortText = z.string().trim().min(1).max(40);

const noExtras = z.object({});
const blackjackDetails = z.object({ tableMinCents: z.number().int().positive().optional() });
const sportsDetails = z.object({
  sport: shortText.optional(),
  betType: shortText.optional(),
  americanOdds: americanOdds.optional(),
});

// SCOPE Q3, plain: every non-poker type reads "Put in" / "Got back (with your stake)". The
// "with your stake" is what stops a bettor typing their profit as the payout (SCOPE H1).
const MONEY_LABELS = { inLabel: 'Put in', outLabel: 'Got back (with your stake)' } as const;

const CASINO = {
  ...MONEY_LABELS,
  extras: [],
  asksHours: true,
  placeRequired: true,
  placeLabel: 'Where',
  titleRequired: false,
  details: noExtras,
} as const;

export const EVENT_TYPES: readonly EventType[] = [
  {
    ...CASINO,
    slug: 'blackjack',
    label: 'Blackjack',
    search: ['21', 'twenty-one', 'twenty one'],
    extras: [{ key: 'tableMinCents', label: 'Table minimum', kind: 'money' }],
    details: blackjackDetails,
  },
  {
    ...CASINO,
    slug: 'sports_betting',
    label: 'Sports betting',
    search: ['sports', 'sportsbook', 'bet', 'wager', 'football', 'basketball', 'baseball', 'hockey', 'soccer'],
    extras: [
      { key: 'sport', label: 'Sport', kind: 'text' },
      { key: 'betType', label: 'Bet type', kind: 'text' },
      { key: 'americanOdds', label: 'Odds', kind: 'odds' },
    ],
    asksHours: false,
    placeRequired: false,
    placeLabel: 'Book',
    details: sportsDetails,
  },
  { ...CASINO, slug: 'slots', label: 'Slots', search: ['slot machine', 'pokies'] },
  { ...CASINO, slug: 'roulette', label: 'Roulette', search: [] },
  { ...CASINO, slug: 'craps', label: 'Craps', search: ['dice'] },
  { ...CASINO, slug: 'baccarat', label: 'Baccarat', search: ['punto banco'] },
  {
    ...CASINO,
    slug: 'lottery',
    label: 'Lottery',
    search: ['lotto', 'scratch', 'scratcher', 'powerball', 'mega millions'],
    asksHours: false,
    placeRequired: false,
  },
  // The catch-all: its title is the player's own name for what they played, so it is required.
  { ...CASINO, slug: 'other', label: 'Other', search: [], placeRequired: false, titleRequired: true },
];

const POKER_OPTION: TypeOption & { search: readonly string[] } = {
  slug: POKER_TYPE,
  label: 'Poker',
  search: ['cash game', 'holdem', "hold'em", 'nlh', 'plo', 'omaha'],
};

export function eventType(slug: string): EventType | undefined {
  return EVENT_TYPES.find((type) => type.slug === slug);
}

// SCOPE H5: a slug renamed or removed from the registry still renders, under its own words.
function humanise(slug: string): string {
  const words = slug.replace(/_+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The label for any stored slug: poker, a registered type, or the slug humanised. */
export function typeLabel(slug: string): string {
  if (slug === POKER_TYPE) return POKER_OPTION.label;
  return eventType(slug)?.label ?? humanise(slug);
}

function matches(option: { label: string; search: readonly string[] }, query: string): boolean {
  return [option.label, ...option.search].some((word) => word.toLowerCase().includes(query));
}

/**
 * The picker's list for what the player typed: poker first, then the registry in order. A query
 * that matches nothing gives Other, so the search never dead-ends (SCOPE K3(a)).
 */
export function searchEventTypes(query: string): TypeOption[] {
  const needle = query.trim().toLowerCase();
  const found = [POKER_OPTION, ...EVENT_TYPES].filter((option) => matches(option, needle));
  const options = found.length ? found : EVENT_TYPES.filter((type) => type.slug === 'other');
  return options.map(({ slug, label }) => ({ slug, label }));
}

/** A stored `details`, checked against its type; null when it fails or the type is unknown (H4). */
export function parseEventDetails(slug: string, details: unknown): EventDetails | null {
  const type = eventType(slug);
  if (!type) return null;
  const parsed = type.details.safeParse(details);
  return parsed.success ? parsed.data : null;
}

export type OddsParse = { kind: 'empty' } | { kind: 'odds'; odds: number } | { kind: 'invalid' };

/** `+150`, `-110` or `150` as typed, to the integer stored (BD-8). Blank is `empty`, not zero. */
export function parseAmericanOdds(text: string): OddsParse {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' };
  if (!/^[+-]?\d+$/.test(trimmed)) return { kind: 'invalid' };
  const odds = Number(trimmed);
  if (!Number.isSafeInteger(odds) || Math.abs(odds) < 100) return { kind: 'invalid' };
  return { kind: 'odds', odds };
}

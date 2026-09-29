// Dials (DESIGN.md §4), named rather than left as literals at their call sites.

/**
 * How often the live session screen re-reads its session-scoped keys while its Realtime
 * channel is NOT `SUBSCRIBED` — a dropped socket, a backgrounded PWA, the gap before the first
 * join. While subscribed the poll is off (0). The 15 s value is the pre-migration poll that D7
 * kept as a dial (web/app/session/[id]/page.tsx:39 before phase 5); phase 11 turned it into a
 * fallback instead of removing it (SCOPE-phase-11.md §4 "Fallback poll interval", §7 Q3).
 */
export const SESSION_FALLBACK_POLL_MS = 15_000;

/**
 * How long the session screen waits after a Realtime event before refetching. One RPC writes
 * several rows in one transaction (SCOPE-phase-11.md §1 row 11 — a pour is an order insert plus
 * an inventory update per ingredient), so without this one pour refetches a key once per row
 * (§4 "Refetch debounce").
 */
export const REALTIME_REFETCH_DEBOUNCE_MS = 250;

/**
 * How many tables member Home lists before a "Show all" (member-home SCOPE.md §4): a member sits
 * at a handful of tables, so this is a fold, not pagination.
 */
export const MEMBER_HOME_TABLE_LIMIT = 5;

/**
 * How far ahead member Home looks for each table's next game (member-home SCOPE.md §4, ratified
 * by the owner 2026-09-29, §7 item 21). Passed to get_my_upcoming_games (0022), which holds no
 * copy of its own.
 */
export const MEMBER_GAME_WINDOW_DAYS = 14;

/**
 * A game the host never started stops showing on member Home this many hours after its start
 * time (owner, 2026-09-29, SCOPE.md §7 item 21), where the host's own list keeps it. Passed to
 * get_my_upcoming_games (0022) beside the window.
 */
export const MEMBER_GAME_STALE_HOURS = 6;

/**
 * The setup guide's checklist on Home (host-setup PLAN phase 3, SCOPE.md §4), in order. Each
 * item's done state is derived from data (useSetupGuide); only the guide's dismissal is stored.
 * Copy: warm register, chosen by the owner 2026-09-29 (R7).
 */
export const SETUP_GUIDE_ITEMS = [
  { key: 'defaultBuyIn', label: 'Pick a default buy-in', href: '/account/settings' },
  { key: 'players', label: 'Add the regulars', href: '/players' },
  { key: 'invite', label: 'Send someone an invite', href: '/invites' },
  { key: 'session', label: 'Deal your first session', href: '/session/new' },
] as const;

export type SetupItemKey = (typeof SETUP_GUIDE_ITEMS)[number]['key'];

/**
 * The most hours one logged session may claim (logged-sessions DESIGN.md §4, PLAN.md BD-7). It
 * catches `300` typed for `3.00` without refusing a marathon. Moved here from phase 1 (BD-8).
 */
export const LOGGED_SESSION_MAX_HOURS = 48;

/** How many of the player's own past venues, and game formats, the log form suggests (§4). */
export const LOGGED_SESSION_SUGGESTIONS = 5;

/** The blinds chips on the log form (§4): the common casino cash games, in cents. */
export const LOGGED_SESSION_STAKES_PRESETS = [
  { smallCents: 100, bigCents: 200 },
  { smallCents: 100, bigCents: 300 },
  { smallCents: 200, bigCents: 500 },
  { smallCents: 500, bigCents: 1000 },
] as const;

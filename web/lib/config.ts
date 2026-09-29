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

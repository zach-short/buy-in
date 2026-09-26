// Dials (DESIGN.md §4), named rather than left as literals at their call sites.

/**
 * How often the live session screen re-reads its orders. D7 keeps the pre-migration 15 s
 * poll (web/app/session/[id]/page.tsx:39 before phase 5) until Realtime replaces it after
 * cutover (PLAN.md phase 11).
 */
export const SESSION_POLL_INTERVAL_MS = 15_000;

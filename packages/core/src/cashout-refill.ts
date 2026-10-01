// What opening the cash-out screen again does to what is already on it. The screen keeps, per
// player, the amount typed and the cents that field was filled from (its snapshot). Closing
// re-reads the cash-outs and refuses if any moved away from the snapshot, so the snapshot must
// always mean "what this field on screen was filled from" — never "what the database says now".

/** playerId → integer cents. */
export type CentsByPlayer = Readonly<Record<string, number>>;

/** playerId → integer cents typed on screen; `null` (or no key) is a blank field. */
export type TypedCents = Readonly<Record<string, number | null>>;

export interface CashoutRefill {
  /** Players whose field the host has not changed since it was filled: they take the database's value, or blank. */
  follow: string[];
  /** The snapshot after the refill: followed players at the database's value, every other entry as it was. */
  snapshot: Record<string, number>;
}

/**
 * Fills the cash-out screen from the database's cash-outs without losing what the host typed.
 *
 * A field the host has not changed follows the database. On the first open nothing has been
 * typed, so every field follows: that is the plain prefill. A field the host changed keeps the
 * typed amount, and its snapshot entry keeps the value it was filled from. So when another
 * device (or this one, from the table) writes that player's cash-out between two visits, the
 * close still sees the snapshot differ from the database and refuses, as it does today for a
 * write made while the screen is open. A player seated in between has no field and no snapshot
 * entry: they follow the database like any untouched field, and stay "not entered" until
 * someone enters them.
 */
export function refillCashouts(snapshot: CentsByPlayer, typed: TypedCents, current: CentsByPlayer): CashoutRefill {
  const ids = new Set([...Object.keys(snapshot), ...Object.keys(typed), ...Object.keys(current)]);
  const follow = [...ids].filter((id) => untouched(centsAt(snapshot, id), typed[id] ?? null));
  const next: Record<string, number> = { ...snapshot };
  for (const id of follow) {
    const now = centsAt(current, id);
    if (now === undefined) delete next[id];
    else next[id] = now;
  }
  return { follow, snapshot: next };
}

/**
 * The close guard: players whose cash-out appeared, vanished or changed amount since the
 * snapshot. Moved unchanged from `changedSince` in web/components/session/use-close-session.ts.
 */
export function cashoutsChangedSince(snapshot: CentsByPlayer, current: CentsByPlayer): string[] {
  const ids = new Set([...Object.keys(snapshot), ...Object.keys(current)]);
  return [...ids].filter((id) => centsAt(snapshot, id) !== centsAt(current, id));
}

// Compared in cents, so "20" over a prefilled "20.00" is still untouched. A field emptied by the
// host is touched: blank is "not entered yet", and the host chose it over the prefilled amount.
function untouched(filledFrom: number | undefined, typed: number | null): boolean {
  return filledFrom === undefined ? typed === null : typed === filledFrom;
}

function centsAt(map: CentsByPlayer, id: string): number | undefined {
  return Object.hasOwn(map, id) ? map[id] : undefined;
}

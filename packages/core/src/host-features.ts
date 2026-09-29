/**
 * Which drinks-side features a table shows (0020, docs/incomplete/host-setup BD-1 and BD-7).
 * Every screen that hides something reads this, so the rules between the three settings are
 * written once:
 *   - `drinksAllowed` is the app owner's gate (BD-7: per-drink charging can be an unlicensed
 *     alcohol sale, so drink tracking is not offered to strangers). Off hides everything.
 *   - `servesDrinks` is the host's own switch, and only counts while drinks are allowed.
 *   - `tracksInventory` only means anything while drinks are on, so turning drinks back on
 *     brings inventory back exactly as the host left it.
 *
 * This decides what is *shown*, never what is *owed*. A drink already on a tab counts toward
 * a balance whatever this returns.
 */
export interface DrinkSettings {
  drinksAllowed: boolean;
  servesDrinks: boolean;
  tracksInventory: boolean;
}

export interface FeatureVisibility {
  drinks: boolean;
  menu: boolean;
  /** Stats is revenue, cost and profit over orders, so it has no meaning without drinks. */
  stats: boolean;
  inventory: boolean;
}

export function featureVisibility({ drinksAllowed, servesDrinks, tracksInventory }: DrinkSettings): FeatureVisibility {
  const drinks = drinksAllowed && servesDrinks;
  return { drinks, menu: drinks, stats: drinks, inventory: drinks && tracksInventory };
}

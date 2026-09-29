import { describe, expect, it } from 'vitest';

import { featureVisibility } from '../src/host-features';

const OFF = { drinks: false, menu: false, stats: false, inventory: false };

describe('featureVisibility', () => {
  it('hides everything when drinks are not allowed, whatever the host switched on', () => {
    expect(featureVisibility({ drinksAllowed: false, servesDrinks: true, tracksInventory: true })).toEqual(OFF);
    expect(featureVisibility({ drinksAllowed: false, servesDrinks: false, tracksInventory: false })).toEqual(OFF);
  });

  it('hides every drinks-side feature when drinks are off, whatever inventory says', () => {
    expect(featureVisibility({ drinksAllowed: true, servesDrinks: false, tracksInventory: true })).toEqual(OFF);
    expect(featureVisibility({ drinksAllowed: true, servesDrinks: false, tracksInventory: false })).toEqual(OFF);
  });

  it('hides only inventory when drinks are on and inventory is off', () => {
    expect(featureVisibility({ drinksAllowed: true, servesDrinks: true, tracksInventory: false }))
      .toEqual({ drinks: true, menu: true, stats: true, inventory: false });
  });

  it('shows everything when drinks are allowed and both switches are on', () => {
    expect(featureVisibility({ drinksAllowed: true, servesDrinks: true, tracksInventory: true }))
      .toEqual({ drinks: true, menu: true, stats: true, inventory: true });
  });
});

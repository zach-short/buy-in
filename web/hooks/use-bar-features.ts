'use client';

import useSWR from 'swr';

import { featureVisibility, type FeatureVisibility, type DrinkSettings } from '@pb/core';
import {
  countBarOrders,
  fetchBarSettings,
  updateServesDrinks,
  updateTracksInventory,
} from '@/lib/supabase/bar-settings';
import { useIsBarStaff } from '@/hooks/use-is-bar-staff';

export interface BarFeatures {
  /** What each drinks-side screen shows. Everything is visible until the settings load. */
  visible: FeatureVisibility;
  /** The settings as stored; `undefined` until loaded. The Settings card reads these, screens read `visible`. */
  settings: DrinkSettings | undefined;
  isLoading: boolean;
  error: Error | undefined;
  setServesDrinks: (on: boolean) => Promise<void>;
  setTracksInventory: (on: boolean) => Promise<void>;
  /** Every drink already on a tab at this bar, for the turn-drinks-off warning. */
  countOrders: () => Promise<number>;
}

// A flash of hidden nav is worse than a flash of shown nav, so loading and a failed load
// both read as "everything on".
const ALL_ON: DrinkSettings = { drinksAllowed: true, servesDrinks: true, tracksInventory: true };

/**
 * The drinks settings (0020), on the same `'bar_settings'` SWR entry as the other bar
 * settings. fetchBarSettings throws for a joined player, who has no bar of their own, so the
 * read waits on the staff check and never runs for a player: Home, Account and Results are
 * shared with members, and they see everything on, as they did before 0020.
 */
export function useBarFeatures(): BarFeatures {
  const isStaff = useIsBarStaff();
  const { data, error, isLoading, mutate } = useSWR(isStaff ? 'bar_settings' : null, fetchBarSettings);
  const settings = data && {
    drinksAllowed: data.drinksAllowed,
    servesDrinks: data.servesDrinks,
    tracksInventory: data.tracksInventory,
  };

  async function write(update: (barId: string) => Promise<void>): Promise<void> {
    if (!data) return;
    await update(data.barId);
    await mutate();
  }

  return {
    visible: featureVisibility(settings ?? ALL_ON),
    settings,
    isLoading,
    error,
    setServesDrinks: (on) => write((barId) => updateServesDrinks(barId, on)),
    setTracksInventory: (on) => write((barId) => updateTracksInventory(barId, on)),
    countOrders: async () => (data ? countBarOrders(data.barId) : 0),
  };
}

'use client';

import { useState } from 'react';
import useSWR from 'swr';

import { fetchBarSettings, dismissSetup, updateServesDrinks } from '@/lib/supabase/bar-settings';
import { fetchSetupProgress } from '@/lib/supabase/setup-progress';
import { SETUP_GUIDE_ITEMS, type SetupItemKey } from '@/lib/config';
import { readDrinksAnswered, rememberDrinksAnswered } from '@/lib/setup-drinks-answered';

export interface SetupItem {
  key: SetupItemKey;
  label: string;
  href: string;
  done: boolean;
}

export interface SetupGuide {
  /** The drinks question: only on a table the owner allowed drinks on (BD-7), until answered here. */
  showQuestion: boolean;
  /** `undefined` hides the checklist: loading, dismissed, failed, or every item already done. */
  items: SetupItem[] | undefined;
  /** Yes or No writes serves_drinks; Skip (`null`) leaves drinks off, as No does (BD-7). */
  answerDrinks: (serves: boolean | null) => Promise<void>;
  dismiss: () => Promise<void>;
}

/**
 * Home's first-run guide (host-setup PLAN phase 3): the drinks question and the checklist.
 * Host Dashboard only, so the staff check has already passed. Shares `'bar_settings'` with
 * useBarFeatures, so an answer hides the drinks side everywhere at once.
 */
export function useSetupGuide(): SetupGuide {
  const settings = useSWR('bar_settings', fetchBarSettings);
  const bar = settings.data;
  const open = bar !== undefined && bar.setupDismissedAt === null;
  // A failed progress read hides the card rather than showing four undone items: the guide is
  // optional, and a wrong "not done" is worse than no card.
  const progress = useSWR(open ? ['setup_progress', bar.barId] : null, ([, barId]) => fetchSetupProgress(barId));
  const [answeredNow, setAnsweredNow] = useState(false);

  const done: Record<SetupItemKey, boolean> | undefined = bar && progress.data && {
    defaultBuyIn: bar.defaultBuyInSetAt !== null,
    ...progress.data,
  };
  const items = open && done ? SETUP_GUIDE_ITEMS.map((item) => ({ ...item, done: done[item.key] })) : undefined;

  async function answerDrinks(serves: boolean | null): Promise<void> {
    if (!bar) return;
    await updateServesDrinks(bar.barId, serves ?? false);
    rememberDrinksAnswered(bar.barId);
    setAnsweredNow(true);
    await settings.mutate();
  }

  async function dismiss(): Promise<void> {
    if (!bar) return;
    await dismissSetup(bar.barId);
    await settings.mutate();
  }

  return {
    showQuestion: open && bar.drinksAllowed && !answeredNow && !readDrinksAnswered(bar.barId),
    items: items?.every((i) => i.done) ? undefined : items,
    answerDrinks,
    dismiss,
  };
}

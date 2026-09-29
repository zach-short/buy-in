'use client';

import type { ReactNode } from 'react';

import type { FeatureVisibility } from '@pb/core';
import { StatusScreen } from '@/components/shared/status-screen';
import { useBarFeatures } from '@/hooks/use-bar-features';

// Copy set by the owner, 2026-09-29: the drinks line is SCOPE.md §7 Q8; the inventory line and
// the not-allowed line were chosen in the phase-2 build (docs/incomplete/host-setup PLAN.md).
const NOT_ALLOWED = 'Drink tracking isn’t available on this table.';
const DRINKS_OFF = 'You’ve got drinks switched off. You can bring them back any time in Settings.';
const INVENTORY_OFF = 'You’ve got inventory switched off. You can bring it back any time in Settings.';

/**
 * Renders a drinks-side screen only while its feature is on (BD-2), so a direct URL to a
 * turned-off page explains itself instead of redirecting. Children do not mount while off, so
 * the screen's own fetches never run.
 */
export function FeatureGate({ feature, children }: { feature: keyof FeatureVisibility; children: ReactNode }) {
  const { visible, settings } = useBarFeatures();
  if (visible[feature]) return children;
  // BD-7: the owner's gate gets one neutral line and nothing to click — Settings would only
  // repeat it.
  if (settings && !settings.drinksAllowed) return <StatusScreen kind='empty' title={NOT_ALLOWED} />;
  const title = feature === 'inventory' && visible.drinks ? INVENTORY_OFF : DRINKS_OFF;
  return <StatusScreen kind='empty' title={title} action={{ label: 'Settings', href: '/account/settings' }} />;
}

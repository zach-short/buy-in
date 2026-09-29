import type { ReactNode } from 'react';

import { FeatureGate } from '@/components/shared/feature-gate';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Inventory',
  description: 'Stock on hand for the bar, with reorder thresholds and unit costs.',
  private: true,
});

export default function Layout({ children }: { children: ReactNode }) {
  return <FeatureGate feature='inventory'>{children}</FeatureGate>;
}

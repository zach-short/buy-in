'use client';

import { use } from 'react';

import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { BarResults } from '@/components/results/bar-results';
import { MyPoker } from '@/components/results/my-poker';
import { ResultsTabs, type ResultsTab } from '@/components/results/results-tabs';
import { FeatureGate } from '@/components/shared/feature-gate';
import { useBarFeatures } from '@/hooks/use-bar-features';
import { useIsBarStaff } from '@/hooks/use-is-bar-staff';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// "The bar" is the host's drink money, so it is offered only to an owner or host. A player who
// follows a ?tab=bar link lands on their own results instead of an empty bar tab. No header
// action: a Back that calls router.back() leaves the app when the page was opened from a link.
// With stats off the tab is gone, so the strip goes with it, but a ?tab=bar link (the old
// /stats bookmark) still shows the turned-off page, which says why (host-setup BD-2).
export default function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const { tab } = use(searchParams);
  const isStaff = useIsBarStaff();
  const { visible } = useBarFeatures();
  const active: ResultsTab = tab === 'bar' && isStaff !== false ? 'bar' : 'poker';

  return (
    <PageMain>
      <PageHeader title='Results' />
      {isStaff && visible.stats && <ResultsTabs active={active} />}
      {active === 'bar' ? <FeatureGate feature='stats'><BarResults /></FeatureGate> : <MyPoker />}
    </PageMain>
  );
}

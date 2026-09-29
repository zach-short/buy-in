'use client';

import { use } from 'react';

import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { BarResults } from '@/components/results/bar-results';
import { MyPoker } from '@/components/results/my-poker';
import { ResultsTabs, type ResultsTab } from '@/components/results/results-tabs';
import { useIsBarStaff } from '@/hooks/use-is-bar-staff';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// "The bar" is the host's drink money, so it is offered only to an owner or host. A player who
// follows a ?tab=bar link lands on their own results instead of an empty bar tab. No header
// action: a Back that calls router.back() leaves the app when the page was opened from a link.
export default function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const { tab } = use(searchParams);
  const isStaff = useIsBarStaff();
  const active: ResultsTab = tab === 'bar' && isStaff !== false ? 'bar' : 'poker';

  return (
    <PageMain>
      <PageHeader title='Results' />
      {isStaff && <ResultsTabs active={active} />}
      {active === 'bar' ? <BarResults /> : <MyPoker />}
    </PageMain>
  );
}

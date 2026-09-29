import type { ReactNode } from 'react';

import { BackAction } from '@/components/shared/layout/back-action';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { StatusScreen } from '@/components/shared/status-screen';

/** The standard page frame every /join screen renders inside, so it matches the rest of the app. */
export function JoinShell({ children }: { children: ReactNode }) {
  return (
    <PageMain>
      <PageHeader title='Join a table' subtitle='Enter your host&apos;s invite' actions={<BackAction fallback='/' />} />
      <div className='space-y-6'>{children}</div>
    </PageMain>
  );
}

/** The one-line status screen for the sign-in check and the sign-up redirect. */
export function JoinStatus({ children }: { children: string }) {
  return <StatusScreen kind='loading' title={children} />;
}

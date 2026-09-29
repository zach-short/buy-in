'use client';

import { use } from 'react';
import useSWR from 'swr';

import { LogSessionForm } from '@/components/results/log-session-form';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { StatusScreen } from '@/components/shared/status-screen';
import { fetchLoggedSession } from '@/lib/supabase/logged-sessions';

// Fix or remove one logged session (PLAN.md BD-1). Another account's id reads exactly like a
// deleted one — RLS returns no row — so both say "not found" rather than an error.
export default function EditLoggedSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: row, error, mutate } = useSWR(['logged_session', id], () => fetchLoggedSession(id));

  if (error && row === undefined) {
    return <StatusScreen kind='error' title='Couldn’t load this session' message={error.message} action={{ label: 'Retry', onClick: () => void mutate() }} />;
  }
  if (row === null) {
    return <StatusScreen kind='empty' title='Session not found' action={{ label: 'All sessions', href: '/results?tab=poker' }} />;
  }
  if (row === undefined) return <StatusScreen kind='loading' />;

  return (
    <PageMain>
      <PageHeader title='Edit session' />
      <LogSessionForm key={row.id} existing={row} />
    </PageMain>
  );
}

'use client';

import { use } from 'react';
import useSWR from 'swr';

import { eventType, typeLabel } from '@pb/core';
import { LogEventForm } from '@/components/results/log-event-form';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { StatusScreen } from '@/components/shared/status-screen';
import { fetchLoggedEvent } from '@/lib/supabase/logged-events';

const EVERYTHING_TAB = '/results?tab=everything';

// Fix or remove one logged event (log-events PLAN.md BD-4). Another account's id reads exactly
// like a deleted one — RLS returns no row — so both say "not found" rather than an error. A row
// whose type the registry no longer knows cannot be edited field by field (SCOPE H5); it still
// counts on the Everything tab, and says so here rather than guessing at its fields.
export default function EditLoggedEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: row, error, mutate } = useSWR(['logged_event', id], () => fetchLoggedEvent(id));

  if (error && row === undefined) {
    return <StatusScreen kind='error' title='Couldn’t load this event' message={error.message} action={{ label: 'Retry', onClick: () => void mutate() }} />;
  }
  if (row === null) {
    return <StatusScreen kind='empty' title='Event not found' action={{ label: 'All results', href: EVERYTHING_TAB }} />;
  }
  if (row === undefined) return <StatusScreen kind='loading' />;

  const type = eventType(row.event_type);
  if (!type) {
    return <StatusScreen kind='empty' title={`${typeLabel(row.event_type)} can’t be edited here`} action={{ label: 'All results', href: EVERYTHING_TAB }} />;
  }

  // Owner's pick, plain register, 2026-09-29 (PLAN.md phase 2 step 6).
  return (
    <PageMain>
      <PageHeader title='Edit event' subtitle={type.label} />
      <LogEventForm key={row.id} type={type} existing={row} />
    </PageMain>
  );
}

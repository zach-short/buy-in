'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';

import { POKER_TYPE, eventType, type EventType } from '@pb/core';
import { EventTypePicker } from '@/components/results/event-type-picker';
import { LogEventForm } from '@/components/results/log-event-form';
import { LogSessionForm } from '@/components/results/log-session-form';
import { PageHeader, PageMain } from '@/components/shared/layout/page';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// log-events PLAN.md BD-3: one page for every kind of result. ?type=<slug> picks the form, and no
// type (or one the registry no longer knows) is poker, so a "Log a session" bookmark still works.
function typeFrom(param: string | string[] | undefined): EventType | typeof POKER_TYPE {
  return (typeof param === 'string' && eventType(param)) || POKER_TYPE;
}

function hrefFor(slug: string): string {
  return slug === POKER_TYPE ? '/results/log' : `/results/log?type=${slug}`;
}

// The title is the owner's pick, plain register, 2026-09-29 (log-events PLAN.md phase 2 step 6).
export default function LogEventPage({ searchParams }: { searchParams: SearchParams }) {
  const type = typeFrom(use(searchParams).type);
  const slug = type === POKER_TYPE ? POKER_TYPE : type.slug;
  const router = useRouter();

  return (
    <PageMain>
      <PageHeader title='Log an event' />
      <div className='space-y-6'>
        {/* replace, not push: Back leaves the page rather than stepping through every type tried. */}
        <EventTypePicker value={slug} onChange={(next) => router.replace(hrefFor(next), { scroll: false })} />
        {/* Keyed by type: switching drops what was typed rather than carrying it into other fields. */}
        {type === POKER_TYPE ? <LogSessionForm /> : <LogEventForm key={type.slug} type={type} />}
      </div>
    </PageMain>
  );
}

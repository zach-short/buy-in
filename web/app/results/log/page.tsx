'use client';

import { LogSessionForm } from '@/components/results/log-session-form';
import { PageHeader, PageMain } from '@/components/shared/layout/page';

// A game played away from any table (logged-sessions DESIGN.md D6, PLAN.md BD-1). The title is
// the owner's pick, plain register, 2026-09-29 (DESIGN.md "Still owed at build").
export default function LogSessionPage() {
  return (
    <PageMain>
      <PageHeader title='Log a session' />
      <LogSessionForm />
    </PageMain>
  );
}

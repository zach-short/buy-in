'use client';

import { BackAction } from '@/components/shared/layout/back-action';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { PATCH_RELEASES, type PatchNoteKind } from '@/lib/patch-notes';

const KIND_LABEL: Record<PatchNoteKind, string> = { new: 'New', fixed: 'Fixed' };

export default function WhatsNewPage() {
  return (
    <PageMain>
      <PageHeader title="What's new" actions={<BackAction fallback='/account/settings' />} />

      {PATCH_RELEASES.map((release) => (
        <section key={release.date} className='border border-border rounded-md p-4 mb-6'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground'>{release.date}</p>
          <h2 className='mt-1 mb-3 text-sm font-semibold'>{release.title}</h2>
          <ul className='space-y-2'>
            {release.notes.map((note) => (
              <li key={note.text} className='flex gap-3 text-sm'>
                <span className='w-12 shrink-0 text-xs tracking-widest uppercase text-primary pt-0.5'>{KIND_LABEL[note.kind]}</span>
                <span className='text-muted-foreground'>{note.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageMain>
  );
}

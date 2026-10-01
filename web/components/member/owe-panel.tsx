'use client';

import { useState } from 'react';

import { formatCents, paidNotice, type TableRecord } from '@pb/core';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
// The same Pay on Venmo / Cash App buttons the portal link shows. member/ borrows them rather
// than keep a second copy that would drift on the URL and note rules.
import { PayPanel } from '@/components/portal/pay-panel';
import { smsHref } from '@/lib/share';
import type { TablePayInfo } from '@/lib/supabase/table-pay-info';

// What the member owes at this table, payments already taken off (record.balanceCents), then a
// way to pay and a way to tell the host. The game net on the card above is a different number.

function payBar(record: TableRecord, pay: TablePayInfo) {
  return {
    id: record.barId,
    name: record.barName,
    venmo_handle: pay.venmoHandle,
    cashapp_handle: pay.cashappHandle,
    venmo_note_template: pay.venmoNoteTemplate,
  };
}

// No recipient: the table has no host phone the member may read, so their messages app asks who.
function TellHost({ cents }: { cents: number }) {
  return (
    <Button asChild size='lg' className='w-full h-11 text-xs tracking-widest uppercase'>
      <a href={smsHref(null, paidNotice(cents))}>
        <MessageSquare aria-hidden='true' /> Text your host you paid ${formatCents(cents)}
      </a>
    </Button>
  );
}

function OweBody({ record, pay }: { record: TableRecord; pay: TablePayInfo | undefined }) {
  const [paidCents, setPaidCents] = useState<number | null>(null);
  return (
    <div className='px-4 pb-4 space-y-3'>
      <p className='text-sm'>
        You owe <span className='font-medium tabular-nums text-destructive'>${formatCents(record.balanceCents)}</span> here
      </p>
      {pay && <PayPanel bar={payBar(record, pay)} balanceCents={record.balanceCents} onPay={setPaidCents} />}
      {paidCents === null ? (
        <button
          type='button'
          onClick={() => setPaidCents(record.balanceCents)}
          className='min-h-11 text-xs tracking-widest uppercase text-muted-foreground underline underline-offset-4 hover:text-foreground'
        >
          I already paid
        </button>
      ) : (
        <TellHost cents={paidCents} />
      )}
    </div>
  );
}

/** Under a table's record: the debt with its pay and notify actions, or the credit, or nothing when even. */
export function OwePanel({ record, pay }: { record: TableRecord; pay: TablePayInfo | undefined }) {
  if (record.balanceCents > 0) return <OweBody record={record} pay={pay} />;
  if (record.balanceCents < 0) {
    return (
      <p className='px-4 pb-4 text-sm'>
        Owed to you <span className='font-medium tabular-nums text-green-500'>${formatCents(-record.balanceCents)}</span>
      </p>
    );
  }
  return null;
}

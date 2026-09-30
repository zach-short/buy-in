'use client';

import { formatCents, leaveTableVerdict } from '@pb/core';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/shared/data-state';
import { useConfirm } from '@/hooks/use-confirm';
import { useMyTables } from '@/hooks/use-my-tables';
import type { MyTable } from '@/lib/supabase/tables';

// Provisional copy in the plain register (R7): the owner picks these lines.
function balanceNote(table: MyTable): { text: string; tone: string } {
  const verdict = leaveTableVerdict(table.balanceCents);
  const amount = formatCents(Math.abs(table.balanceCents));
  if (verdict === 'blocked') return { text: `You owe $${amount}. Settle up with the host to leave.`, tone: 'text-destructive' };
  if (verdict === 'owed') return { text: `You're owed $${amount}`, tone: 'text-green-500' };
  return { text: 'All settled', tone: 'text-muted-foreground' };
}

interface TableRowProps {
  table: MyTable;
  busy: boolean;
  onLeave: (table: MyTable) => void;
}

function TableRow({ table, busy, onLeave }: TableRowProps) {
  const note = balanceNote(table);
  const blocked = leaveTableVerdict(table.balanceCents) === 'blocked';
  return (
    <li className='flex items-center justify-between gap-4 py-4 border-b border-border'>
      <div className='min-w-0'>
        <p className='text-sm truncate'>{table.barName}</p>
        <p className={`text-xs ${note.tone}`}>{note.text}</p>
      </div>
      <Button
        variant='outline'
        className='h-11 shrink-0 text-xs tracking-widest uppercase'
        disabled={blocked || busy}
        onClick={() => onLeave(table)}
      >
        <LogOut aria-hidden='true' />
        {busy ? 'Leaving…' : 'Leave table'}
      </Button>
    </li>
  );
}

/** The tables this account is seated at, each with a Leave button the balance can disable. */
export function MyTables() {
  const { confirm, confirmDialog } = useConfirm();
  const { tables, leaving, leave } = useMyTables(confirm);
  return (
    <div className='mb-10'>
      {confirmDialog}
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>Your tables</p>
      <DataState
        rows={tables.data}
        error={tables.error}
        onRetry={() => tables.mutate()}
        empty={<p className='text-xs text-muted-foreground py-4'>You aren&apos;t seated at anyone&apos;s table.</p>}
      >
        {(rows) => (
          <ul className='border-t border-border'>
            {rows.map((table) => (
              <TableRow key={table.barId} table={table} busy={leaving === table.barId} onLeave={leave} />
            ))}
          </ul>
        )}
      </DataState>
    </div>
  );
}

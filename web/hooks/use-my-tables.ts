'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';

import { formatCents, leaveTableVerdict } from '@pb/core';
import type { ConfirmApi } from '@/hooks/use-confirm';
import { fetchMyTables, leaveTable, type MyTable } from '@/lib/supabase/tables';

// Provisional copy in the plain register (R7): the owner picks the wording of both prompts.
function confirmText(table: MyTable): string {
  if (leaveTableVerdict(table.balanceCents) === 'owed') {
    return `${table.barName} owes you $${formatCents(Math.abs(table.balanceCents))}. If you leave, you can no longer see it here, so ask the host to pay you first. Leave anyway?`;
  }
  return `Leave ${table.barName}? You'd need a new invite to come back.`;
}

/** The Account screen's list of tables, and the one action on each. `confirm` comes from the page's `useConfirm`. */
export function useMyTables(confirm: ConfirmApi['confirm']) {
  const { mutate } = useSWRConfig();
  const tables = useSWR('my_tables', fetchMyTables);
  const [leaving, setLeaving] = useState<string | null>(null);

  async function leave(table: MyTable) {
    const ok = await confirm({ title: `Leave ${table.barName}?`, description: confirmText(table), confirmLabel: 'Leave', destructive: true });
    if (!ok) return;
    setLeaving(table.barId);
    try {
      await leaveTable(table.barId, leaveTableVerdict(table.balanceCents) === 'owed');
      toast.success(`You left ${table.barName}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLeaving(null);
      await tables.mutate();
      // The row is no longer this account's, so its sessions drop out of the performance page.
      await mutate('get_my_performance');
    }
  }

  return { tables, leaving, leave };
}

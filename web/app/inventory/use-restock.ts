'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { addInventoryStock } from '@/lib/supabase/inventory';
import type { InventoryRow } from '@/lib/supabase/queries';
import { parseQty } from './stock';

type Received = { item: InventoryRow; qty: number };

function receivedRows(items: InventoryRow[], draft: Record<string, string>): Received[] | string {
  const rows: Received[] = [];
  for (const item of items) {
    const qty = parseQty(draft[item.id] ?? '');
    if (qty === null || qty === 0) continue;
    if (Number.isNaN(qty)) return `${item.name}: received must be a number`;
    rows.push({ item, qty });
  }
  return rows;
}

// Writes go one at a time so a failure is pinned to its item: the ones that landed leave the
// draft, the ones that did not stay filled in for another try.
export function useRestock(items: InventoryRow[], refresh: () => unknown) {
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function toggle() {
    setActive((a) => !a);
    setDraft({});
  }

  function setReceived(id: string, value: string) {
    setDraft((d) => ({ ...d, [id]: value }));
  }

  async function save() {
    const rows = receivedRows(items, draft);
    if (typeof rows === 'string') return void toast.error(rows);
    if (!rows.length) return void toast.error('Enter what you received first');
    setSaving(true);
    const failed: Record<string, string> = {};
    for (const { item, qty } of rows) {
      try {
        await addInventoryStock(item.id, qty);
      } catch (e) {
        failed[item.id] = draft[item.id];
        toast.error(`${item.name}: ${(e as Error).message}`);
      }
    }
    setSaving(false);
    const saved = rows.length - Object.keys(failed).length;
    if (saved) toast.success(`Restocked ${saved} item${saved === 1 ? '' : 's'}`);
    setDraft(failed);
    if (saved === rows.length) setActive(false);
    refresh();
  }

  return { active, draft, saving, toggle, setReceived, save };
}

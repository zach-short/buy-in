'use client';

import { use } from 'react';
import useSWR from 'swr';

import { MenuBoard } from '@/components/shared/menu-board';
import { fetchMenu } from '@/lib/supabase/public';

// Per-bar, so no single-bar assumption ships (owner, 2026-09-27, in place of PLAN.md §3's
// NEXT_PUBLIC_BAR_ID dial). get_menu returns [] for an unknown bar id — the same empty board
// as a bar with nothing in stock — so a guessed id learns nothing (0001, get_menu).
export default function BarMenuPage({ params }: { params: Promise<{ barId: string }> }) {
  const { barId } = use(params);
  const { data: items = [] } = useSWR(['menu', barId], ([, id]) => fetchMenu(id));
  return <MenuBoard items={items} />;
}

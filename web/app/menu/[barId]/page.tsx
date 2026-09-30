'use client';

import { use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';

import { MenuBoard } from '@/components/shared/menu-board';
import { useIsBarStaff } from '@/hooks/use-is-bar-staff';
import { shareOrCopy } from '@/lib/share';
import { fetchMenu } from '@/lib/supabase/public';
import { fetchBarId } from '@/lib/supabase/queries';

// Per-bar, so no single-bar assumption ships (owner, 2026-09-27, in place of PLAN.md §3's
// NEXT_PUBLIC_BAR_ID dial). get_menu returns [] for an unknown bar id — the same empty board
// as a bar with nothing in stock — so a guessed id learns nothing (0001, get_menu).
export default function BarMenuPage({ params }: { params: Promise<{ barId: string }> }) {
  const { barId } = use(params);
  const { data: items, error, mutate } = useSWR(['menu', barId], ([, id]) => fetchMenu(id));
  const isHost = useIsHostOf(barId);
  const status = items ? 'ready' : error ? 'error' : 'loading';
  return (
    <MenuBoard
      items={items ?? []}
      status={status}
      onRetry={() => void mutate()}
      actions={isHost ? <HostActions barId={barId} /> : undefined}
    />
  );
}

// Staff of this bar only: useIsBarStaff answers for any bar, so the bar id must match too.
// Guests (signed out, or a member) never trigger the bar read.
function useIsHostOf(barId: string): boolean {
  const isStaff = useIsBarStaff();
  const { data: ownBarId } = useSWR(isStaff ? 'bar_id' : null, fetchBarId);
  return isStaff === true && ownBarId === barId;
}

const HOST_ACTION = 'inline-flex min-h-11 items-center px-4 rounded-md border text-xs tracking-widest uppercase';
const HOST_ACTION_STYLE = { borderColor: '#c9a84c99', color: '#c9a84c' };

// An installed PWA has no address bar, so the host had no way to get this link to a guest.
function HostActions({ barId }: { barId: string }) {
  async function share() {
    const result = await shareOrCopy(`${window.location.origin}/menu/${barId}`);
    if (result === 'copied') toast.success('Menu link copied');
    else if (result === 'failed') toast.error("Couldn't share or copy the link");
  }

  return (
    <div className='mt-8 flex flex-wrap justify-center gap-3'>
      <button type='button' className={HOST_ACTION} style={HOST_ACTION_STYLE} onClick={() => void share()}>
        Share menu link
      </button>
      <Link href='/drinks' className={HOST_ACTION} style={HOST_ACTION_STYLE}>
        Edit drinks
      </Link>
    </div>
  );
}

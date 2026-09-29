'use client';

import { useState } from 'react';
import useSWR from 'swr';

import type { ShareResult } from '@/lib/share';
import {
  fetchGameInviteToken,
  mintGameInvite,
  shareGameInvite,
  type ScheduledGameRow,
} from '@/lib/supabase/scheduled-games';

export interface GameInvite {
  /** undefined until loaded (or after a failed read); null when the game has no live invite. */
  token: string | null | undefined;
  making: boolean;
  /** Shares or copies the invite link; 'failed' when there is no token yet. */
  share: () => Promise<ShareResult>;
  make: () => Promise<void>;
}

// The token is read when the row renders, not on tap, so the share or clipboard write happens
// inside the tap itself: Safari only allows either during the user's gesture, and one that
// first waits on a network read can land outside it.
export function useGameInvite(game: ScheduledGameRow): GameInvite {
  const { data: token, mutate } = useSWR<string | null, Error>(
    ['bar_invite_links', game.id],
    () => fetchGameInviteToken(game.id),
  );
  const [making, setMaking] = useState(false);

  async function share(): Promise<ShareResult> {
    return token ? shareGameInvite(token) : 'failed';
  }

  // A game can be left with no invite — the mint after scheduling failed and the host left
  // /schedule/new without retrying, or the link was revoked — and must not be stranded.
  async function make(): Promise<void> {
    setMaking(true);
    try {
      await mutate(await mintGameInvite(game), { revalidate: false });
    } finally {
      setMaking(false);
    }
  }

  return { token, making, share, make };
}

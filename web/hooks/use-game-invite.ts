'use client';

import { useState } from 'react';
import useSWR from 'swr';

import { fetchGameInviteToken, mintGameInvite, rsvpUrl, type GameRef } from '@/lib/supabase/scheduled-games';

export interface GameInvite {
  /** undefined until loaded (or after a failed read); null when the game has no live invite. */
  token: string | null | undefined;
  making: boolean;
  copy: () => Promise<void>;
  make: () => Promise<void>;
}

// The token is read when the row renders, not on tap, so the clipboard write happens inside
// the tap itself: Safari only allows a write during the user's gesture, and one that first
// waits on a network read can land outside it.
export function useGameInvite(game: GameRef): GameInvite {
  const { data: token, mutate } = useSWR<string | null, Error>(
    ['bar_invite_links', game.id],
    () => fetchGameInviteToken(game.id),
  );
  const [making, setMaking] = useState(false);

  async function copy(): Promise<void> {
    if (token) await navigator.clipboard.writeText(rsvpUrl(token));
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

  return { token, making, copy, make };
}

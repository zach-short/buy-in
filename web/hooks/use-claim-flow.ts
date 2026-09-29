'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import {
  fetchClaimState, requestClaim, type ClaimFailure, type ClaimablePlayer, type ClaimState,
} from '@/lib/supabase/claims';

// While a request waits, the page re-reads it this often so an approval lands without a reload
// (focus also refetches — SWR's default). Nothing pushes an approval to the claimant (PASSOFF
// item 17: no email or push); this poll is the whole of "they'll see it".
const WAITING_POLL_MS = 15_000;

/**
 * 'loading' until the first read; 'home' once the account holds a row here (the page leaves);
 * 'picking' the name list; 'new' today's JoinNameForm path; 'waiting' a request is pending.
 */
export type ClaimView = 'loading' | 'home' | 'failed' | 'picking' | 'new' | 'waiting';

const UNREACHABLE = "Couldn't reach Buy-In. Check your connection and try again.";

// Copy is provisional, the build's plain register (R7) — the owner picks the words.
const CLAIM_ERRORS: Record<ClaimFailure, string> = {
  'invalid-invite': "That invite didn't work — it may be mistyped, expired or revoked. Ask your host for a new one.",
  'already-at-table': "You're already at this table.",
  'name-unavailable': 'That name was just taken. Pick another, or join as someone new.',
  'request-waiting': 'You already asked to be someone at this table. Wait for your host to answer.',
  unreachable: UNREACHABLE,
  unknown: 'Something went wrong. Try again.',
};

function isWaiting(state: ClaimState | undefined): boolean {
  return state?.kind === 'open' && state.myRequest?.status === 'pending';
}

function viewOf(state: ClaimState | undefined, choseNew: boolean): ClaimView {
  if (!state) return 'loading';
  if (state.kind === 'at-table') return 'home';
  if (state.kind === 'failed') return 'failed';
  if (state.myRequest?.status === 'pending') return 'waiting';
  // No names to claim is the table this feature did not exist for: today's name form, unchanged.
  if (choseNew || !state.players.length) return 'new';
  return 'picking';
}

function nameOf(players: ClaimablePlayer[], id: string | undefined): string {
  return players.find((p) => p.id === id)?.name ?? '';
}

/** The claim step of /join/[token], run once the visitor is signed in (`enabled`). */
export function useClaimFlow(token: string, enabled: boolean) {
  const router = useRouter();
  const state = useSWR(enabled ? (['claim_state', token] as const) : null, ([, t]) => fetchClaimState(t), {
    refreshInterval: (data) => (isWaiting(data) ? WAITING_POLL_MS : 0),
  });
  const [choseNew, setChoseNew] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  const view = state.error && !state.data ? 'failed' : viewOf(state.data, choseNew);
  const open = state.data?.kind === 'open' ? state.data : null;
  const players = open?.players ?? [];

  // Approval, or a join as someone new, both end with this account holding a row: go home, as a
  // successful join already does (use-join-flow.ts).
  useEffect(() => {
    if (view === 'home') router.replace('/');
  }, [view, router]);

  async function pick(playerId: string) {
    setRequesting(true);
    setError('');
    const result = await requestClaim(token, playerId);
    setRequesting(false);
    if (!result.ok) setError(CLAIM_ERRORS[result.reason]);
    await state.mutate();
  }

  return {
    view,
    players,
    requesting,
    error: error || (state.data?.kind === 'failed' ? CLAIM_ERRORS[state.data.reason] : state.error ? UNREACHABLE : ''),
    waitingFor: nameOf(players, open?.myRequest?.playerId),
    rejectedName: open?.myRequest?.status === 'rejected' ? nameOf(players, open.myRequest.playerId) : '',
    pick,
    chooseNew: () => setChoseNew(true),
    backToNames: () => setChoseNew(false),
    retry: () => void state.mutate(),
  };
}

export type ClaimFlow = ReturnType<typeof useClaimFlow>;

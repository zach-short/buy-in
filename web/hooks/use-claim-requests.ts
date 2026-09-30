'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';

import type { ConfirmApi } from '@/hooks/use-confirm';
import { decideClaim, fetchPendingClaims, type DecideOutcome, type PendingClaim } from '@/lib/supabase/claims';

// Copy chosen by the owner 2026-09-29 (R7).
function outcomeToast(outcome: DecideOutcome, claim: PendingClaim): void {
  if (outcome === 'approved') return void toast.success(`${claim.playerName} is now linked`);
  if (outcome === 'rejected') return void toast.success('Request declined');
  if (outcome === 'player-taken') return void toast.error(`Someone else already claimed ${claim.playerName}`);
  toast.error('That account already has a player here. Use Move on its player page.');
}

// Both answers are asked first: an approval hands the claimant a real balance and history, and
// a rejection is one tap from Approve. The email leads for the reason ClaimRow gives (the name
// is self-asserted). Wording is provisional (R7), not yet the owner's.
function decisionPrompt(claim: PendingClaim, approve: boolean) {
  const who = claim.requesterEmail ?? claim.requesterName ?? 'this person';
  return approve
    ? {
      title: `Link ${who} to ${claim.playerName}?`,
      description: `They will see ${claim.playerName}'s balance and history.`,
      confirmLabel: 'Approve',
    }
    : {
      title: `Reject ${who}?`,
      description: `They will not be linked to ${claim.playerName}.`,
      confirmLabel: 'Reject',
      destructive: true,
    };
}

/** The host's approval queue on /invites: pending claims for one bar, and the two answers. */
export function useClaimRequests(barId: string | undefined, confirm: ConfirmApi['confirm']) {
  const { mutate } = useSWRConfig();
  const pending = useSWR(barId ? (['claim_requests', barId] as const) : null, ([, id]) => fetchPendingClaims(id));
  const [deciding, setDeciding] = useState<string | null>(null);

  async function decide(claim: PendingClaim, approve: boolean) {
    if (!(await confirm(decisionPrompt(claim, approve)))) return;
    setDeciding(claim.id);
    try {
      outcomeToast(await decideClaim(claim.id, approve), claim);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeciding(null);
      await pending.mutate();
      // An approval changes who a row belongs to; /players and "Recently joined" read that.
      await mutate('players');
      await mutate(['players_joined', barId]);
    }
  }

  return { pending, deciding, decide };
}

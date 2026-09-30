'use client';

import { useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';

import { formatDate } from '@pb/core';
import { Check, X } from 'lucide-react';
import { CreateInviteForm } from '@/components/invites/create-invite-form';
import { InviteRow } from '@/components/invites/invite-row';
import { DataState } from '@/components/shared/data-state';
import { BackAction } from '@/components/shared/layout/back-action';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { useClaimRequests } from '@/hooks/use-claim-requests';
import { useConfirm } from '@/hooks/use-confirm';
import { shareOrCopy } from '@/lib/share';
import type { PendingClaim } from '@/lib/supabase/claims';
import { fetchBarId } from '@/lib/supabase/queries';
import {
  createStandingInvite, fetchRecentJoins, fetchStandingInvites, joinUrl, revokeInvite,
  type NewInvite, type RecentJoin, type StandingInvite,
} from '@/lib/supabase/standing-invites';
import { Button } from '@/components/ui/button';

const SECTION_LABEL = 'text-xs tracking-widest uppercase text-muted-foreground mb-3';
const STATE_TEXT = 'text-center text-muted-foreground text-xs tracking-widest uppercase py-8';

// D2 through the shared DataState, with a Retry: an installed PWA has no reload button.
// `rows` is also undefined while the bar id is still loading.
function ListState<Row>({ rows, error, empty, onRetry, children }: {
  rows: Row[] | undefined;
  error: Error | undefined;
  empty: string;
  onRetry: () => void;
  children: (rows: Row[]) => ReactNode;
}) {
  return (
    <DataState rows={rows} error={error} onRetry={onRetry} empty={<p className={STATE_TEXT}>{empty}</p>}>
      {(loaded) => <div className='space-y-2'>{children(loaded)}</div>}
    </DataState>
  );
}

// The row may not show the raw link, so a share sheet and a clipboard that both fail (a
// plain-http origin, a denied permission) put the link in the error toast instead: the host
// still has a way to copy it by hand. A dismissed sheet is the host's answer — no toast. Only the
// link goes out, with no sentence around it, so share targets unfurl it into the invite card
// naming the table (owner, 2026-09-30); a code the host reads out or copies from the row.
async function shareInvite(invite: StandingInvite): Promise<void> {
  const url = joinUrl(invite.token);
  const result = await shareOrCopy(url);
  if (result === 'copied') toast.success('Invite link copied');
  if (result === 'failed') toast.error("Couldn't share or copy. Here it is:", { description: url, duration: 20000 });
}

function JoinRow({ player }: { player: RecentJoin }) {
  return (
    <div className='flex items-center justify-between gap-3 border border-border rounded-md px-4 py-3'>
      <span className='text-sm font-medium'>{player.name}</span>
      <span className='text-xs text-muted-foreground shrink-0'>Joined {formatDate(player.created_at)}</span>
    </div>
  );
}

interface ClaimRowProps {
  claim: PendingClaim;
  deciding: boolean;
  onDecide: (approve: boolean) => void;
}

// PASSOFF item 17: who asked is the email and name their account had when they asked (0008
// copies both), because a host cannot read accounts and would otherwise approve a stranger.
// The email leads because the name is self-asserted — the claimant's own profile name, which
// can be anything, including the very player they are claiming. Wording chosen by the owner 2026-09-29 (R7).
function ClaimRow({ claim, deciding, onDecide }: ClaimRowProps) {
  const who = claim.requesterEmail ?? claim.requesterName ?? 'Someone';
  return (
    <div className='border border-border rounded-md px-4 py-3 space-y-2'>
      <p className='text-sm'>
        <span className='font-medium break-all'>{who}</span> says they&apos;re <span className='font-medium'>{claim.playerName}</span>
      </p>
      {claim.requesterEmail && claim.requesterName && (
        <p className='text-xs text-muted-foreground'>{claim.requesterName}</p>
      )}
      <div className='flex items-center justify-between gap-3'>
        <span className='text-xs text-muted-foreground'>Asked {formatDate(claim.createdAt)}</span>
        <div className='flex gap-2 shrink-0'>
          <Button variant='outline' size='sm' className='h-11 text-xs tracking-widest uppercase' onClick={() => onDecide(false)} disabled={deciding}>
            <X aria-hidden='true' />
            Reject
          </Button>
          <Button size='sm' className='h-11 text-xs tracking-widest uppercase' onClick={() => onDecide(true)} disabled={deciding}>
            <Check aria-hidden='true' />
            {deciding ? 'Saving…' : 'Approve'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InvitesPage() {
  const { data: barId, error: barError, mutate: mutateBar } = useSWR('bar_id', fetchBarId);
  const invites = useSWR(barId ? (['bar_invite_links', barId] as const) : null, ([, id]) => fetchStandingInvites(id));
  const joins = useSWR(barId ? (['players_joined', barId] as const) : null, ([, id]) => fetchRecentJoins(id));
  const { confirm, confirmDialog } = useConfirm();
  const claims = useClaimRequests(barId, confirm);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  // A failed bar read fails every list; retrying it re-keys them all.
  const retry = (list: { mutate: () => unknown }) => () => void (barError ? mutateBar() : list.mutate());
  const waiting = (claims.pending.data?.length ?? 0) > 0;

  async function handleCreate(invite: NewInvite): Promise<boolean> {
    if (!barId) return false;
    setCreating(true);
    try {
      await createStandingInvite(barId, invite);
      toast.success('Invite created');
      await invites.mutate();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(token: string) {
    const ok = await confirm({
      title: 'Revoke this invite?',
      description: "It stops working for anyone who hasn't joined yet.",
      confirmLabel: 'Revoke',
      destructive: true,
    });
    if (!ok) return;
    setRevoking(token);
    try {
      await revokeInvite(token);
      toast.success('Invite revoked');
      await invites.mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRevoking(null);
    }
  }

  const claimsSection = (
    <section className='mb-10'>
      <p className={SECTION_LABEL}>Waiting For You</p>
      <ListState rows={claims.pending.data} error={barError ?? claims.pending.error} empty='No one is waiting' onRetry={retry(claims.pending)}>
        {(rows) => rows.map((claim) => (
          <ClaimRow
            key={claim.id}
            claim={claim}
            deciding={claims.deciding === claim.id}
            onDecide={(approve) => void claims.decide(claim, approve)}
          />
        ))}
      </ListState>
    </section>
  );

  return (
    <PageMain>
      {confirmDialog}
      <PageHeader
        title='Invites'
        subtitle='Anyone with a live link or code can join your table'
        actions={<BackAction fallback='/account' />}
      />

      {/* Someone waiting is the one thing here that needs the host now, so it leads. */}
      {waiting && claimsSection}

      <CreateInviteForm disabled={!barId} creating={creating} onCreate={handleCreate} />

      {!waiting && claimsSection}

      <section className='mb-10'>
        <p className={SECTION_LABEL}>Invites</p>
        <ListState rows={invites.data} error={barError ?? invites.error} empty='No invites yet' onRetry={retry(invites)}>
          {(rows) => rows.map((invite) => (
            <InviteRow
              key={invite.token}
              invite={invite}
              revoking={revoking === invite.token}
              onRevoke={() => handleRevoke(invite.token)}
              onShare={() => void shareInvite(invite)}
              onChanged={() => invites.mutate()}
            />
          ))}
        </ListState>
      </section>

      <section>
        <p className={SECTION_LABEL}>Recently Joined</p>
        <ListState rows={joins.data} error={barError ?? joins.error} empty='Nobody has joined yet' onRetry={retry(joins)}>
          {(rows) => rows.map((player) => <JoinRow key={player.id} player={player} />)}
        </ListState>
      </section>
    </PageMain>
  );
}

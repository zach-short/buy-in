'use client';

import { useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';

import { formatDate } from '@pb/core';
import { BackAction } from '@/components/shared/layout/back-action';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { useClaimRequests } from '@/hooks/use-claim-requests';
import { useConfirm } from '@/hooks/use-confirm';
import { shareOrCopy } from '@/lib/share';
import type { PendingClaim } from '@/lib/supabase/claims';
import { fetchBarId } from '@/lib/supabase/queries';
import {
  createStandingInvite, fetchRecentJoins, fetchStandingInvites, joinUrl, revokeInvite,
  type RecentJoin, type StandingInvite,
} from '@/lib/supabase/standing-invites';
import { Button } from '@/components/ui/button';

const SECTION_LABEL = 'text-xs tracking-widest uppercase text-muted-foreground mb-3';
const STATE_TEXT = 'text-center text-muted-foreground text-xs tracking-widest uppercase py-8';

interface ListStateProps<Row> {
  rows: Row[] | undefined;
  error: Error | undefined;
  empty: string;
  children: (rows: Row[]) => ReactNode;
}

// D2: both lists render loading, error and empty through this one component, so neither can
// ship with only two of them. `rows` is also undefined while the bar id is still loading.
function ListState<Row>({ rows, error, empty, children }: ListStateProps<Row>) {
  if (error) return <p className='text-center text-xs text-destructive py-8'>{error.message}</p>;
  if (!rows) return <p className={STATE_TEXT}>Loading…</p>;
  if (!rows.length) return <p className={STATE_TEXT}>{empty}</p>;
  return <div className='space-y-2'>{children(rows)}</div>;
}

function statusLine({ status, expires_at, revoked_at }: StandingInvite): string {
  if (revoked_at) return `Revoked ${formatDate(revoked_at)}`;
  return `${status === 'live' ? 'Expires' : 'Expired'} ${formatDate(expires_at)}`;
}

// The row no longer shows the raw link, so a share sheet and a clipboard that both fail (a
// plain-http origin, a denied permission) put the link in the error toast instead: the host
// still has a way to copy it by hand. A dismissed sheet is the host's answer — no toast.
async function shareInvite(token: string): Promise<void> {
  const url = joinUrl(token);
  const result = await shareOrCopy(url);
  if (result === 'copied') toast.success('Invite link copied');
  if (result === 'failed') toast.error("Couldn't share or copy. Here's the link:", { description: url, duration: 20000 });
}

interface InviteRowProps {
  invite: StandingInvite;
  revoking: boolean;
  onRevoke: () => void;
}

function InviteRow({ invite, revoking, onRevoke }: InviteRowProps) {
  const live = invite.status === 'live';
  return (
    <div className={`border border-border rounded-md px-4 py-3 space-y-2 ${live ? '' : 'opacity-60'}`}>
      <p className='text-sm font-medium'>Invite link · made {formatDate(invite.created_at)}</p>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-xs text-muted-foreground'>{statusLine(invite)}</span>
        {live && (
          <div className='flex gap-2 shrink-0'>
            <Button variant='outline' size='sm' className='text-xs tracking-widest uppercase' onClick={() => void shareInvite(invite.token)}>
              Share
            </Button>
            <Button variant='outline' size='sm' className='text-xs tracking-widest uppercase' onClick={onRevoke} disabled={revoking}>
              {revoking ? 'Revoking…' : 'Revoke'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
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
          <Button variant='outline' size='sm' className='text-xs tracking-widest uppercase' onClick={() => onDecide(false)} disabled={deciding}>
            Reject
          </Button>
          <Button size='sm' className='text-xs tracking-widest uppercase' onClick={() => onDecide(true)} disabled={deciding}>
            {deciding ? 'Saving…' : 'Approve'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InvitesPage() {
  const { data: barId, error: barError } = useSWR('bar_id', fetchBarId);
  const invites = useSWR(barId ? (['bar_invite_links', barId] as const) : null, ([, id]) => fetchStandingInvites(id));
  const joins = useSWR(barId ? (['players_joined', barId] as const) : null, ([, id]) => fetchRecentJoins(id));
  const claims = useClaimRequests(barId);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  async function handleCreate() {
    if (!barId) return;
    setCreating(true);
    try {
      await createStandingInvite(barId);
      toast.success('Invite link created');
      await invites.mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(token: string) {
    const ok = await confirm({
      title: 'Revoke this invite link?',
      description: "It stops working for anyone who hasn't joined yet.",
      confirmLabel: 'Revoke',
      destructive: true,
    });
    if (!ok) return;
    setRevoking(token);
    try {
      await revokeInvite(token);
      toast.success('Invite link revoked');
      await invites.mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRevoking(null);
    }
  }

  return (
    <PageMain>
      {confirmDialog}
      <PageHeader
        title='Invites'
        subtitle='Anyone with a live link can join your table'
        actions={<BackAction fallback='/account' />}
      />

      <Button className='w-full h-10 text-xs tracking-widest uppercase mb-10' onClick={handleCreate} disabled={!barId || creating}>
        {creating ? 'Creating…' : 'Create Invite Link'}
      </Button>

      <section className='mb-10'>
        <p className={SECTION_LABEL}>Waiting For You</p>
        <ListState rows={claims.pending.data} error={barError ?? claims.pending.error} empty='No one is waiting'>
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

      <section className='mb-10'>
        <p className={SECTION_LABEL}>Invite Links</p>
        <ListState rows={invites.data} error={barError ?? invites.error} empty='No invite links yet'>
          {(rows) => rows.map((invite) => (
            <InviteRow
              key={invite.token}
              invite={invite}
              revoking={revoking === invite.token}
              onRevoke={() => handleRevoke(invite.token)}
            />
          ))}
        </ListState>
      </section>

      <section>
        <p className={SECTION_LABEL}>Recently Joined</p>
        <ListState rows={joins.data} error={barError ?? joins.error} empty='Nobody has joined yet'>
          {(rows) => rows.map((player) => <JoinRow key={player.id} player={player} />)}
        </ListState>
      </section>
    </PageMain>
  );
}

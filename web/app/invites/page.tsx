'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';

import { formatDate } from '@pb/core';
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

// The link stays on screen with `select-all`, so a refused clipboard (a plain-http origin,
// a denied permission) still leaves the host a way to copy it by hand.
async function copyInvite(token: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(joinUrl(token));
    toast.success('Invite link copied');
  } catch {
    toast.error("Couldn't copy. Select the link and copy it by hand.");
  }
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
      <p className='text-xs font-mono break-all select-all'>{joinUrl(invite.token)}</p>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-xs text-muted-foreground'>{statusLine(invite)}</span>
        {live && (
          <div className='flex gap-2 shrink-0'>
            <Button variant='outline' size='sm' className='text-xs tracking-widest uppercase' onClick={() => copyInvite(invite.token)}>
              Copy
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

export default function InvitesPage() {
  const router = useRouter();
  const { data: barId, error: barError } = useSWR('bar_id', fetchBarId);
  const invites = useSWR(barId ? (['bar_invite_links', barId] as const) : null, ([, id]) => fetchStandingInvites(id));
  const joins = useSWR(barId ? (['players_joined', barId] as const) : null, ([, id]) => fetchRecentJoins(id));
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

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
    if (!window.confirm("Revoke this invite link? It stops working for anyone who hasn't joined yet.")) return;
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
    <main className='min-h-screen px-6 py-10 max-w-3xl mx-auto'>
      <div className='flex items-center justify-between mb-10'>
        <div>
          <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Invites</h1>
          <p className='text-xs text-muted-foreground mt-0.5'>Anyone with a live link can join your table</p>
        </div>
        <button
          onClick={() => router.back()}
          className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
        >
          Back
        </button>
      </div>

      <Button className='w-full h-10 text-xs tracking-widest uppercase mb-10' onClick={handleCreate} disabled={!barId || creating}>
        {creating ? 'Creating…' : 'Create Invite Link'}
      </Button>

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
    </main>
  );
}

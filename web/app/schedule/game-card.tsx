import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';

import { formatDate, formatTime } from '@pb/core';
import { Check, Play } from 'lucide-react';
import { fetchGameRsvps, type GameRsvp, type RsvpStatus, type ScheduledGameRow } from '@/lib/supabase/scheduled-games';
import { useGameInvite, type GameInvite } from '@/hooks/use-game-invite';
import { announceShare } from '@/app/schedule/announce-share';
import { useEditGame } from '@/app/schedule/use-edit-game';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SECONDARY =
  'flex-1 h-10 rounded border border-border text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40';
const LINK = 'text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40';

const GROUPS: { status: RsvpStatus; label: string }[] = [
  { status: 'yes', label: 'Going' },
  { status: 'maybe', label: 'Maybe' },
  { status: 'no', label: "Can't" },
];

interface GameCardProps {
  game: ScheduledGameRow;
  starting: boolean;
  /** A start is in flight: one at a time, since each one navigates away. */
  locked: boolean;
  onStart: () => void;
  onCancel: () => void;
  /** The game was renamed or moved; the list re-reads so it stays in time order. */
  onEdited: () => void;
}

export function GameCard({ game, starting, locked, onStart, onCancel, onEdited }: GameCardProps) {
  const rsvps = useSWR<GameRsvp[], Error>(['game_rsvps', game.id, 'roster'], () => fetchGameRsvps(game));
  const invite = useGameInvite(game);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className='border border-border rounded-md px-4 py-4 space-y-4'>
      {editing ? (
        <EditGame game={game} onDone={(saved) => { setEditing(false); if (saved) onEdited(); }} />
      ) : (
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-sm font-medium truncate'>{game.name}</p>
            <p className='text-xs text-muted-foreground mt-0.5'>
              {formatDate(game.scheduled_at)} · {formatTime(game.scheduled_at)}
            </p>
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            title={rsvps.error?.message}
            className='shrink-0 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded border mt-0.5 border-primary text-primary'
          >
            {headcount(rsvps.data, rsvps.error)} {open ? '▴' : '▾'}
          </button>
        </div>
      )}

      {open && <Roster rsvps={rsvps.data} error={rsvps.error} onRetry={() => void rsvps.mutate()} />}

      <div className='flex gap-3'>
        <InviteButton invite={invite} />
        <Button onClick={onStart} disabled={locked} className='flex-1 h-10 text-xs tracking-widest uppercase'>
          <Play aria-hidden='true' />
          {starting ? 'Starting…' : 'Start Game'}
        </Button>
      </div>

      {!editing && (
        <div className='flex justify-end gap-5'>
          <button onClick={() => setEditing(true)} disabled={locked} className={LINK}>Edit</button>
          <button onClick={onCancel} disabled={locked} className={`${LINK} hover:text-destructive`}>Cancel Game</button>
        </div>
      )}
    </div>
  );
}

// "5 going · 2 maybe": the two answers a host plans chairs around. Can't stays in the roster.
function headcount(rows: GameRsvp[] | undefined, error: Error | undefined): string {
  if (!rows) return error ? '? going' : '… going';
  const going = rows.filter((r) => r.status === 'yes').length;
  const maybe = rows.filter((r) => r.status === 'maybe').length;
  return maybe > 0 ? `${going} going · ${maybe} maybe` : `${going} going`;
}

interface RosterProps {
  rsvps: GameRsvp[] | undefined;
  error: Error | undefined;
  onRetry: () => void;
}

function Roster({ rsvps, error, onRetry }: RosterProps) {
  if (!rsvps && error) {
    return (
      <p className='text-xs text-destructive'>
        {error.message} <button onClick={onRetry} className='underline text-muted-foreground'>Retry</button>
      </p>
    );
  }
  if (!rsvps) return <p className='text-xs text-muted-foreground'>Loading…</p>;
  if (rsvps.length === 0) return <p className='text-xs text-muted-foreground'>No answers yet — share the invite</p>;

  return (
    <div className='space-y-3 border-t border-border pt-3'>
      {GROUPS.map(({ status, label }) => (
        <RosterGroup key={status} label={label} rsvps={rsvps.filter((r) => r.status === status)} />
      ))}
    </div>
  );
}

// A guest who answered without joining the table has no name the host can read (see
// fetchGameRsvps), so they show as a numbered guest rather than disappearing from the list.
function RosterGroup({ label, rsvps }: { label: string; rsvps: GameRsvp[] }) {
  if (rsvps.length === 0) return null;
  let unnamed = 0;
  const names = rsvps.map((r) => r.name ?? `Guest ${++unnamed}`);

  return (
    <div>
      <p className='text-[10px] tracking-widest uppercase text-muted-foreground mb-1'>
        {label} · {rsvps.length}
      </p>
      <p className='text-sm break-words'>{names.join(', ')}</p>
    </div>
  );
}

function EditGame({ game, onDone }: { game: ScheduledGameRow; onDone: (saved: boolean) => void }) {
  const form = useEditGame(game);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.canSave) return;
    try {
      await form.save();
      toast.success('Game updated');
      onDone(true);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-3'>
      <Input aria-label='Name' value={form.name} onChange={(e) => form.setName(e.target.value)} />
      <div className='flex gap-2'>
        <Input aria-label='Date' type='date' value={form.date} onChange={(e) => form.setDate(e.target.value)} />
        <Input
          aria-label='Time'
          type='time'
          value={form.time}
          onChange={(e) => form.setTime(e.target.value)}
          className='w-32 shrink-0'
        />
      </div>
      <div className='flex gap-3'>
        <button type='button' onClick={() => onDone(false)} disabled={form.saving} className={SECONDARY}>
          Discard
        </button>
        <Button type='submit' disabled={!form.canSave} className='flex-1 h-10 text-xs tracking-widest uppercase'>
          <Check aria-hidden='true' />
          {form.saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

async function withToast(action: () => Promise<void>, done: string): Promise<void> {
  try {
    await action();
    toast.success(done);
  } catch (e) {
    toast.error((e as Error).message);
  }
}

// Minting is a separate tap from sharing: the share has to run inside a tap with no network
// wait before it (see useGameInvite).
function InviteButton({ invite }: { invite: GameInvite }) {
  if (invite.token === null) {
    return (
      <button onClick={() => withToast(invite.make, 'Invite link made — tap Share')} disabled={invite.making} className={SECONDARY}>
        {invite.making ? 'Making…' : 'Make Invite'}
      </button>
    );
  }
  return (
    <button
      onClick={async () => announceShare(await invite.share())}
      disabled={!invite.token}
      title='Share the invite message'
      className={SECONDARY}
    >
      Share Invite
    </button>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';

import { formatDate, formatTime } from '@pb/core';
import {
  fetchUpcomingGames,
  fetchYesCount,
  startScheduledGame,
  type ScheduledGameRow,
} from '@/lib/supabase/scheduled-games';
import { HeaderAction, PageHeader, PageMain } from '@/components/shared/layout/page';
import { useGameInvite, type GameInvite } from '@/hooks/use-game-invite';
import { DataState } from '@/components/shared/data-state';
import { Button } from '@/components/ui/button';

const SECONDARY =
  'flex-1 h-10 rounded border border-border text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40';

export default function SchedulePage() {
  const router = useRouter();
  const { data: games, error, mutate } = useSWR<ScheduledGameRow[], Error>(['scheduled_games', 'upcoming'], fetchUpcomingGames);
  const [startingId, setStartingId] = useState<string | null>(null);

  async function startGame(gameId: string) {
    setStartingId(gameId);
    try {
      const sessionId = await startScheduledGame(gameId);
      // Started, the game leaves this list; drop it now so Back cannot offer a second start.
      void mutate((rows) => rows?.filter((g) => g.id !== gameId), { revalidate: false });
      router.push(`/session/${sessionId}`);
    } catch (e) {
      toast.error((e as Error).message);
      setStartingId(null);
    }
  }

  return (
    <PageMain>
      <PageHeader
        title='Schedule'
        subtitle={games ? `${games.length} upcoming` : undefined}
        actions=<HeaderAction onClick={() => router.back()}>Back</HeaderAction>
      />

      <Button
        size='lg'
        className='w-full h-12 text-xs tracking-widest uppercase mb-6'
        onClick={() => router.push('/schedule/new')}
      >
        Schedule a Game
      </Button>

      <DataState rows={games} error={error} onRetry={() => void mutate()} empty={<NoGames />}>
        {(rows) => (
          <div className='space-y-3'>
            {rows.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                starting={startingId === game.id}
                locked={startingId !== null}
                onStart={() => startGame(game.id)}
              />
            ))}
          </div>
        )}
      </DataState>
    </PageMain>
  );
}

function NoGames() {
  return (
    <div className='text-center py-12 space-y-2'>
      <p className='text-muted-foreground text-xs tracking-widest uppercase'>No games scheduled</p>
      <p className='text-xs text-muted-foreground'>Schedule one to get a link guests can RSVP through</p>
    </div>
  );
}

interface GameCardProps {
  game: ScheduledGameRow;
  starting: boolean;
  /** A start is in flight: one at a time, since each one navigates away. */
  locked: boolean;
  onStart: () => void;
}

function GameCard({ game, starting, locked, onStart }: GameCardProps) {
  const rsvps = useSWR<number, Error>(['game_rsvps', game.id], () => fetchYesCount(game.id));
  const invite = useGameInvite(game);
  const going = rsvps.error ? '?' : (rsvps.data ?? '…');

  return (
    <div className='border border-border rounded-md px-4 py-4 space-y-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='text-sm font-medium truncate'>{game.name}</p>
          <p className='text-xs text-muted-foreground mt-0.5'>
            {formatDate(game.scheduled_at)} · {formatTime(game.scheduled_at)}
          </p>
        </div>
        <span
          title={rsvps.error?.message}
          className='shrink-0 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded border mt-0.5 border-primary text-primary'
        >
          {going} going
        </span>
      </div>
      <div className='flex gap-3'>
        <InviteButton invite={invite} />
        <Button onClick={onStart} disabled={locked} className='flex-1 h-10 text-xs tracking-widest uppercase'>
          {starting ? 'Starting…' : 'Start Game'}
        </Button>
      </div>
    </div>
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

// Minting is a separate tap from copying: the copy has to run inside a tap with no network
// wait before it (see useGameInvite).
function InviteButton({ invite }: { invite: GameInvite }) {
  if (invite.token === null) {
    return (
      <button onClick={() => withToast(invite.make, 'Invite link made — tap Copy')} disabled={invite.making} className={SECONDARY}>
        {invite.making ? 'Making…' : 'Make Invite'}
      </button>
    );
  }
  return (
    <button
      onClick={() => withToast(invite.copy, 'Invite link copied')}
      disabled={!invite.token}
      title='Copy invite link'
      className={SECONDARY}
    >
      Copy Invite
    </button>
  );
}

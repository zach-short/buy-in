'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { CalendarPlus } from 'lucide-react';

import {
  cancelScheduledGame,
  fetchUpcomingGames,
  startScheduledGame,
  type ScheduledGameRow,
} from '@/lib/supabase/scheduled-games';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { DataState } from '@/components/shared/data-state';
import { useConfirm } from '@/hooks/use-confirm';
import { GameCard } from '@/app/schedule/game-card';
import { Button } from '@/components/ui/button';

export default function SchedulePage() {
  const router = useRouter();
  // Same key as the home page's NextGameCard, so a start, cancel or edit here updates both.
  const { data: games, error, mutate } = useSWR<ScheduledGameRow[], Error>(['scheduled_games', 'upcoming'], fetchUpcomingGames);
  const [startingId, setStartingId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  function dropGame(gameId: string) {
    void mutate((rows) => rows?.filter((g) => g.id !== gameId), { revalidate: false });
  }

  async function startGame(gameId: string) {
    setStartingId(gameId);
    try {
      const sessionId = await startScheduledGame(gameId);
      // Started, the game leaves this list; drop it now so Back cannot offer a second start.
      dropGame(gameId);
      router.push(`/session/${sessionId}`);
    } catch (e) {
      toast.error((e as Error).message);
      setStartingId(null);
    }
  }

  async function cancelGame(game: ScheduledGameRow) {
    const ok = await confirm({
      title: `Cancel ${game.name}?`,
      description: 'It leaves your schedule, and guests who open the invite will see it is cancelled.',
      confirmLabel: 'Cancel Game',
      cancelLabel: 'Keep It',
      destructive: true,
    });
    if (!ok) return;
    try {
      await cancelScheduledGame(game.id);
      dropGame(game.id);
      toast.success('Game cancelled');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <PageMain>
      <PageHeader title='Schedule' subtitle={games ? `${games.length} upcoming` : undefined} />

      <Button asChild size='lg' className='w-full h-12 text-xs tracking-widest uppercase mb-6'>
        <Link href='/schedule/new'><CalendarPlus aria-hidden='true' /> Schedule a Game</Link>
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
                onCancel={() => cancelGame(game)}
                onEdited={() => void mutate()}
              />
            ))}
          </div>
        )}
      </DataState>

      {confirmDialog}
    </PageMain>
  );
}

function NoGames() {
  return (
    <div className='text-center py-12 space-y-2'>
      <p className='text-muted-foreground text-xs tracking-widest uppercase'>No games scheduled</p>
      <p className='text-xs text-muted-foreground'>
        <Link href='/schedule/new' className='underline hover:text-foreground'>Schedule a game</Link> to get a link guests can RSVP through
      </p>
    </div>
  );
}

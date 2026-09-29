'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';

import { formatDate, formatTime } from '@pb/core';
import { Play } from 'lucide-react';
import {
  fetchUpcomingGames,
  fetchYesCount,
  startScheduledGame,
  type ScheduledGameRow,
} from '@/lib/supabase/scheduled-games';
import { Button } from '@/components/ui/button';

interface NextGameCardProps {
  /** A session is already live: starting a second one from home would only confuse the night. */
  canStart: boolean;
}

// The home page's glance at the soonest scheduled game. Renders nothing while loading, on an
// error or with no game: home stays uncluttered, and /schedule owns the full states.
export function NextGameCard({ canStart }: NextGameCardProps) {
  // Same key as /schedule, so the two pages share one cached list.
  const { data: games, mutate } = useSWR<ScheduledGameRow[], Error>(['scheduled_games', 'upcoming'], fetchUpcomingGames);
  const game = games?.[0];
  if (!game) return null;
  return <GameSummary game={game} canStart={canStart} onStarted={() => void mutate()} />;
}

interface GameSummaryProps {
  game: ScheduledGameRow;
  canStart: boolean;
  onStarted: () => void;
}

function GameSummary({ game, canStart, onStarted }: GameSummaryProps) {
  const router = useRouter();
  const rsvps = useSWR<number, Error>(['game_rsvps', game.id], () => fetchYesCount(game.id));
  const going = rsvps.error ? '?' : (rsvps.data ?? '…');
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    try {
      const sessionId = await startScheduledGame(game.id);
      onStarted();
      router.push(`/session/${sessionId}`);
    } catch (e) {
      toast.error((e as Error).message);
      setStarting(false);
    }
  }

  return (
    <div className='mb-10'>
      <div className='flex items-baseline justify-between mb-4'>
        <p className='text-xs tracking-widest uppercase text-muted-foreground'>Next Game</p>
        <Link href='/schedule' className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground'>
          Schedule
        </Link>
      </div>
      <div className='border border-border rounded-md p-4 flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <p className='text-sm font-medium truncate'>{game.name}</p>
          <p className='text-xs text-muted-foreground mt-0.5'>
            {formatDate(game.scheduled_at)} · {formatTime(game.scheduled_at)} · {going} going
          </p>
        </div>
        {canStart && (
          <Button onClick={start} disabled={starting} className='shrink-0 h-9 text-xs tracking-widest uppercase'>
            <Play aria-hidden='true' />
            {starting ? 'Starting…' : 'Start this game'}
          </Button>
        )}
      </div>
    </div>
  );
}

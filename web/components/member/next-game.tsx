'use client';

import type { NextGame, RsvpAnswer } from '@pb/core';
import { Button } from '@/components/ui/button';

// Copy chosen by the owner 2026-09-29 (member-home SCOPE.md §7, item 21): terse "In / Out", no
// Maybe, and the plain "Next game:" line. A 'maybe' given through the host's link shows as
// neither button pressed.
const CHOICES: readonly { status: RsvpAnswer; label: string }[] = [
  { status: 'yes', label: 'In' },
  { status: 'no', label: 'Out' },
];

/** "Fri Oct 3, 8:00 PM", in the viewer's own time zone — the host's share text uses the same form. */
function shortWhen(scheduledAt: string): string {
  const d = new Date(scheduledAt);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${weekday} ${day}, ${time}`;
}

interface NextGameRowProps {
  game: NextGame;
  onAnswer: (gameId: string, status: RsvpAnswer) => Promise<void>;
}

/** A table's next game under its card, with the member's answer. Sits outside the card's link. */
export function NextGameRow({ game, onAnswer }: NextGameRowProps) {
  return (
    <div className='flex items-center justify-between gap-3 border-t border-border px-4 py-3'>
      <div className='min-w-0'>
        <p className='text-sm truncate'>{game.name}</p>
        <p className='text-xs text-muted-foreground tabular-nums'>
          Next game: <span className='whitespace-nowrap'>{shortWhen(game.scheduledAt)}</span>
        </p>
      </div>
      <div role='group' aria-label={`Your answer for ${game.name}`} className='flex gap-2 shrink-0'>
        {CHOICES.map((choice) => (
          <Button
            key={choice.status}
            type='button'
            size='sm'
            variant={game.myStatus === choice.status ? 'default' : 'outline'}
            aria-pressed={game.myStatus === choice.status}
            onClick={() => game.myStatus !== choice.status && void onAnswer(game.gameId, choice.status)}
            className='w-14 tracking-widest uppercase text-xs'
          >
            {choice.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

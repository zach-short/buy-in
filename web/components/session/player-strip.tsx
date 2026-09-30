'use client';

import { formatCents } from '@pb/core';

import type { PlayerRow } from '@/lib/supabase/queries';
import { cn } from '@/lib/utils';

export interface StripPlayer {
  player: Pick<PlayerRow, 'id' | 'name'>;
  tabCents: number;
  buyInCents: number;
  paid: boolean;
  /** Has a cash-out row — including a busted $0 one. */
  out: boolean;
}

interface PlayerStripProps {
  players: readonly StripPlayer[];
  /**
   * False while drinks are off: a $0 drinks figure then means nothing, but a player with a
   * drink already on their tab still shows it, because it is part of what they owe.
   */
  showEmptyTabs: boolean;
  selectedId: string | null;
  addOpen: boolean;
  onSelect: (playerId: string) => void;
  onToggleAdd: () => void;
}

// The chip shows three bare figures; read aloud in a row they say nothing about which is which.
function chipLabel({ player, tabCents, buyInCents, paid, out }: StripPlayer, showTab: boolean): string {
  const parts = [player.name, ...(showTab ? [`drinks $${formatCents(tabCents)}`] : []), `bought in $${formatCents(buyInCents)}`];
  if (out) parts.push('cashed out');
  if (paid) parts.push('tab checked');
  return parts.join(', ');
}

export function PlayerStrip({ players, showEmptyTabs, selectedId, addOpen, onSelect, onToggleAdd }: PlayerStripProps) {
  return (
    <div className='px-6 py-4 flex gap-2 overflow-x-auto scrollbar-none shrink-0 border-b border-border'>
      {players.map((entry) => {
        const { player, tabCents, buyInCents, paid, out } = entry;
        const showTab = showEmptyTabs || tabCents > 0;
        return (
          <button
            key={player.id}
            type='button'
            aria-label={chipLabel(entry, showTab)}
            aria-pressed={selectedId === player.id}
            onClick={() => onSelect(player.id)}
            className={cn(
              'flex-none flex flex-col items-center gap-0.5 px-4 py-2 rounded border transition-colors min-w-[80px] min-h-11',
              selectedId === player.id
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
              out && selectedId !== player.id && 'opacity-60',
            )}
          >
            <span className='text-xs font-medium truncate max-w-[88px]'>{player.name}</span>
            {showTab && <span className='text-xs tabular-nums'>${formatCents(tabCents)}</span>}
            <span className='text-[11px] tabular-nums text-muted-foreground'>In ${formatCents(buyInCents)}</span>
            {(paid || out) && (
              <span className='flex gap-1 text-[9px] tracking-widest uppercase'>
                {out && <span className='text-foreground'>Out</span>}
                {paid && <span className='text-green-500'>Checked</span>}
              </span>
            )}
          </button>
        );
      })}
      <button
        type='button'
        aria-label={addOpen ? 'Close add player' : 'Add player'}
        aria-expanded={addOpen}
        onClick={onToggleAdd}
        className={cn(
          'flex-none flex items-center justify-center px-3 rounded border transition-colors min-w-11 min-h-11',
          addOpen
            ? 'border-primary text-primary'
            : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
        )}
      >
        <span className='text-lg leading-none' aria-hidden='true'>+</span>
      </button>
    </div>
  );
}

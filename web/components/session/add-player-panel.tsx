'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { MoneyInput, parseMoneyInput } from '@/components/ui/money-input';
import type { ConfirmOptions } from '@/hooks/use-confirm';
import { useDefaultBuyIn } from '@/hooks/use-default-buy-in';
import type { PlayerRow } from '@/lib/supabase/queries';
import { addSessionPlayer, createPlayer } from '@/lib/supabase/writes';
import { confirmLargeAmount, writeFailureMessage } from './money-guards';
import type { LiveSession } from './use-live-session';

interface AddPlayerPanelProps {
  sessionId: string;
  seatedIds: readonly string[];
  players: readonly PlayerRow[];
  live: LiveSession;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  onAdded: (playerId: string) => void;
}

export function AddPlayerPanel({ sessionId, seatedIds, players, live, confirm, onAdded }: AddPlayerPanelProps) {
  const [search, setSearch] = useState('');
  // The bar's saved default (as on /session/new) until the host types; never saved back.
  const { value: defaultBuyIn } = useDefaultBuyIn();
  const [buyInDraft, setBuyInDraft] = useState<string | null>(null);
  const buyIn = buyInDraft ?? defaultBuyIn;
  const [adding, setAdding] = useState(false);

  const query = search.trim();
  const matches = players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) && !seatedIds.includes(p.id));

  // Pick, because a player just created arrives as createPlayer's id-and-name, not a whole PlayerRow.
  async function seat(player: Pick<PlayerRow, 'id' | 'name'>, buyInCents: number) {
    // One transaction (0002 add_session_player): the Go screen PATCHed playerIds and then
    // posted the buy-in, and a failure between left a player with no buy-in. A $0 buy-in
    // writes no buy_ins row.
    await addSessionPlayer(sessionId, player.id, buyInCents);
    if (buyInCents > 0) void live.mutateBuyIns();
    await live.mutateSession();
    toast.success(`${player.name} added`);
    onAdded(player.id);
  }

  /** The typed buy-in as cents once the host has confirmed it; null when they have not. */
  async function checkedBuyIn(name: string): Promise<number | null> {
    const cents = parseMoneyInput(buyIn);
    if (cents === null) {
      toast.error('Enter a buy-in — $0 for none');
      return null;
    }
    return (await confirmLargeAmount(confirm, cents, 'buy-in', name)) ? cents : null;
  }

  async function add(existing: Pick<PlayerRow, 'id' | 'name'> | null, newName: string) {
    if (existing && seatedIds.includes(existing.id)) {
      toast.error(`${existing.name} is already in this session`);
      return;
    }
    const cents = await checkedBuyIn(existing?.name ?? newName);
    if (cents === null) return;
    setAdding(true);
    try {
      const player = existing ?? (await createPlayer({ name: newName, phone: '', venmo: '' }));
      if (!existing) await live.mutatePlayers();
      await seat(player, cents);
    } catch (e) {
      toast.error(writeFailureMessage(e, 'No connection — player not added'));
    } finally {
      setAdding(false);
    }
  }

  function addFromSearch() {
    if (!query) return;
    const exact = players.find((p) => p.name.toLowerCase() === query.toLowerCase() && !seatedIds.includes(p.id));
    void add(exact ?? null, query);
  }

  return (
    <div className='px-6 py-4 border-b border-border space-y-3'>
      <div className='flex items-start gap-2'>
        <Input
          autoFocus
          aria-label='Search or add player'
          placeholder='Search or add player…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addFromSearch()}
          className='h-11 text-sm flex-1'
          disabled={adding}
        />
        <MoneyInput
          aria-label='Buy-in'
          placeholder='Buy-in'
          value={buyIn}
          onValueChange={setBuyInDraft}
          containerClassName='w-28 shrink-0'
          disabled={adding}
        />
      </div>
      {query && matches.length === 0 && (
        <button
          type='button'
          onClick={() => add(null, query)}
          disabled={adding}
          className='w-full min-h-11 text-left text-sm px-3 py-2 rounded border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40'
        >
          + Create &ldquo;{query}&rdquo;
        </button>
      )}
      {query && matches.length > 0 && (
        <div className='border border-border rounded-md divide-y divide-border'>
          {matches.map((p) => (
            <button
              key={p.id}
              type='button'
              onClick={() => add(p, p.name)}
              disabled={adding}
              className='w-full min-h-11 text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors disabled:opacity-40'
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';

import { toCents } from '@pb/core';
import { fetchPlayers, type PlayerRow } from '@/lib/supabase/queries';
import { createPlayer, startSession as writeStartSession } from '@/lib/supabase/writes';
import { useDefaultBuyIn } from '@/hooks/use-default-buy-in';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SelectedPlayer {
  // `selected` holds both a PlayerRow from the list below and createPlayer's id-and-name
  // from addNewPlayer, and only `id` and `name` are ever read from it.
  player: Pick<PlayerRow, 'id' | 'name'>;
  buyIn: string;
}

export default function NewSessionPage() {
  const router = useRouter();
  const { data: players = [], mutate } = useSWR('players', fetchPlayers);

  const [name, setName] = useState('Poker');
  const [selected, setSelected] = useState<SelectedPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  // The bar's saved default, set on /players. An edit here is this session's only; it is never saved back.
  const {
    value: defaultBuyIn, setValue: setDefaultBuyIn, isLoading: defaultBuyInLoading, error: defaultBuyInError,
  } = useDefaultBuyIn();
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);

  const filtered = players.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      !selected.find((s) => s.player.id === p.id),
  );

  function addPlayer(player: Pick<PlayerRow, 'id' | 'name'>) {
    setSelected((prev) => [...prev, { player, buyIn: defaultBuyIn }]);
    setSearch('');
  }

  function removePlayer(id: string) {
    setSelected((prev) => prev.filter((s) => s.player.id !== id));
  }

  function updateBuyIn(id: string, value: string) {
    setSelected((prev) =>
      prev.map((s) => s.player.id === id ? { ...s, buyIn: value } : s)
    );
  }

  async function addNewPlayer() {
    if (!newPlayerName.trim()) return;
    setCreating(true);
    try {
      const player = await createPlayer({ name: newPlayerName.trim(), phone: '', venmo: '' });
      await mutate();
      setSelected((prev) => [...prev, { player, buyIn: defaultBuyIn }]);
      setNewPlayerName('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function startSession() {
    if (!name.trim() || selected.length === 0) return;
    setStarting(true);
    try {
      // One transaction (0002 start_session): a zero or blank buy-in writes no row, as the
      // Go-era `parseFloat(s.buyIn) > 0` filter did.
      const sessionId = await writeStartSession(
        name.trim(),
        selected.map((s) => ({ playerId: s.player.id, buyInCents: toCents(parseFloat(s.buyIn) || 0) })),
      );
      router.push(`/session/${sessionId}`);
    } catch (e) {
      toast.error((e as Error).message);
      setStarting(false);
    }
  }

  return (
    <main className='min-h-screen px-6 py-10 max-w-sm mx-auto'>
      <div className='flex items-center justify-between mb-10'>
        <button
          onClick={() => router.back()}
          className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors min-h-[44px]'
        >
          ← Back
        </button>
        <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>New Session</h1>
        <span className='w-16' />
      </div>

      <div className='space-y-6'>
        <div>
          <label className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>Session name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='h-11'
            placeholder='Poker Night — Apr 11'
          />
        </div>

        <div>
          <label className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>Default buy-in</label>
          <div className='relative'>
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm'>$</span>
            <Input
              type='number'
              min='0'
              step='5'
              value={defaultBuyIn}
              onChange={(e) => setDefaultBuyIn(e.target.value)}
              disabled={defaultBuyInLoading}
              className='h-11 pl-7'
              placeholder={defaultBuyInLoading ? 'Loading…' : '20'}
            />
          </div>
          {defaultBuyInError ? (
            <p className='text-xs text-destructive mt-1'>Couldn&apos;t load your default buy-in: {defaultBuyInError.message}</p>
          ) : (
            <p className='text-xs text-muted-foreground mt-1'>Pre-fills for new additions — edit per player below</p>
          )}
        </div>

        {selected.length > 0 && (
          <div>
            <label className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>
              Players ({selected.length})
            </label>
            <div className='border border-border rounded-md divide-y divide-border'>
              {selected.map(({ player, buyIn }) => (
                <div key={player.id} className='flex items-center gap-3 px-4 py-3'>
                  <span className='flex-1 text-sm font-medium truncate'>{player.name}</span>
                  <div className='relative w-24 shrink-0'>
                    <span className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs'>$</span>
                    <Input
                      type='number'
                      min='0'
                      step='5'
                      value={buyIn}
                      onChange={(e) => updateBuyIn(player.id, e.target.value)}
                      className='h-8 pl-6 text-sm text-right pr-2'
                    />
                  </div>
                  <button
                    onClick={() => removePlayer(player.id)}
                    className='text-muted-foreground hover:text-destructive transition-colors text-lg leading-none shrink-0'
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>
            {selected.length > 0 ? 'Add more players' : 'Players'}
          </label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='h-11 mb-2'
            placeholder='Search players…'
          />
          {filtered.length > 0 && (
            <div className='border border-border rounded-md divide-y divide-border'>
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addPlayer(p)}
                  className='w-full text-left px-4 py-3 text-sm hover:bg-secondary transition-colors min-h-[44px]'
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>New player</label>
          <div className='flex gap-2'>
            <Input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNewPlayer()}
              className='h-11'
              placeholder='Name'
            />
            <Button
              onClick={addNewPlayer}
              disabled={creating || !newPlayerName.trim()}
              className='h-11 px-5 shrink-0 text-sm tracking-widest'
            >
              +
            </Button>
          </div>
        </div>

        <Button
          size='lg'
          className='w-full h-12 text-xs tracking-widest uppercase mt-2'
          onClick={startSession}
          disabled={starting || !name.trim() || selected.length === 0}
        >
          {starting ? 'Starting…' : `Start Session · ${selected.length} player${selected.length !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { CalendarCheck, History, Play, Plus } from 'lucide-react';

import { BackAction } from '@/components/shared/layout/back-action';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { fetchPlayers, type PlayerRow } from '@/lib/supabase/queries';
import { createPlayer, startSession as writeStartSession } from '@/lib/supabase/writes';
import { useDefaultBuyIn } from '@/hooks/use-default-buy-in';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput, parseMoneyInput } from '@/components/ui/money-input';
import { useDefaultSessionName } from './use-default-session-name';
import { useQuickRosters } from './use-quick-rosters';

interface SelectedPlayer {
  // `selected` holds both a PlayerRow from the list below and createPlayer's id-and-name
  // from addNewPlayer, and only `id` and `name` are ever read from it.
  player: Pick<PlayerRow, 'id' | 'name'>;
  buyIn: string;
}

export default function NewSessionPage() {
  const router = useRouter();
  const { data: players = [], mutate } = useSWR('players', fetchPlayers);

  // null until the host types, so the dated default shows without an effect copying it in.
  const defaultName = useDefaultSessionName();
  const [nameDraft, setName] = useState<string | null>(null);
  const name = nameDraft ?? defaultName;
  const [selected, setSelected] = useState<SelectedPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  // The bar's saved default, set on /players. An edit here is this session's only; it is never saved back.
  const {
    value: defaultBuyIn, setValue: setDefaultBuyIn, isLoading: defaultBuyInLoading, error: defaultBuyInError,
  } = useDefaultBuyIn();
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const { lastTime, tonight } = useQuickRosters(players);

  const filtered = players.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      !selected.find((s) => s.player.id === p.id),
  );

  function addPlayer(player: Pick<PlayerRow, 'id' | 'name'>) {
    setSelected((prev) => [...prev, { player, buyIn: defaultBuyIn }]);
    setSearch('');
  }

  // Adds whoever is not seated yet; a player already picked keeps the buy-in typed for them.
  function addPlayers(list: Pick<PlayerRow, 'id' | 'name'>[]) {
    setSelected((prev) => [
      ...prev,
      ...list.filter((p) => !prev.some((s) => s.player.id === p.id)).map((player) => ({ player, buyIn: defaultBuyIn })),
    ]);
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
        selected.map((s) => ({ playerId: s.player.id, buyInCents: parseMoneyInput(s.buyIn) ?? 0 })),
      );
      router.push(`/session/${sessionId}`);
    } catch (e) {
      toast.error((e as Error).message);
      setStarting(false);
    }
  }

  return (
    <PageMain>
      <PageHeader title='New Session' actions={<BackAction fallback='/' />} />

      <div className='space-y-6'>
        <div>
          <label className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>Session name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='h-11'
            placeholder='Poker — Fri Oct 3'
          />
        </div>

        <div>
          <label className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>Default buy-in</label>
          <MoneyInput
            value={defaultBuyIn}
            onValueChange={setDefaultBuyIn}
            disabled={defaultBuyInLoading}
            placeholder={defaultBuyInLoading ? 'Loading…' : '20'}
          />
          {defaultBuyInError ? (
            <p className='text-xs text-destructive mt-1'>Couldn&apos;t load your default buy-in: {defaultBuyInError.message}</p>
          ) : (
            <p className='text-xs text-muted-foreground mt-1'>Pre-fills for new additions — edit per player below</p>
          )}
        </div>

        {(lastTime.length > 0 || (tonight && tonight.players.length > 0)) && (
          <div className='flex flex-wrap gap-2'>
            {lastTime.length > 0 && (
              <Button variant='outline' className='h-11 text-xs tracking-widest uppercase' onClick={() => addPlayers(lastTime)}>
                <History aria-hidden='true' />
                Same players as last time ({lastTime.length})
              </Button>
            )}
            {tonight && tonight.players.length > 0 && (
              <Button variant='outline' className='h-11 text-xs tracking-widest uppercase' onClick={() => addPlayers(tonight.players)}>
                <CalendarCheck aria-hidden='true' />
                Tonight&apos;s yes RSVPs ({tonight.players.length})
              </Button>
            )}
          </div>
        )}

        {selected.length > 0 && (
          <div>
            <label className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>
              Players ({selected.length})
            </label>
            <div className='border border-border rounded-md divide-y divide-border'>
              {selected.map(({ player, buyIn }) => (
                <div key={player.id} className='flex items-center gap-3 px-4 py-3'>
                  <span className='flex-1 text-sm font-medium truncate'>{player.name}</span>
                  <MoneyInput
                    value={buyIn}
                    onValueChange={(value) => updateBuyIn(player.id, value)}
                    aria-label={`${player.name}'s buy-in`}
                    containerClassName='w-24 shrink-0'
                    className='text-right pr-2'
                  />
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
              aria-label='Add player'
            >
              <Plus aria-hidden='true' />
            </Button>
          </div>
        </div>

        <Button
          size='lg'
          className='w-full h-12 text-xs tracking-widest uppercase mt-2'
          onClick={startSession}
          disabled={starting || !name.trim() || selected.length === 0}
        >
          <Play aria-hidden='true' />
          {starting ? 'Starting…' : `Start Session · ${selected.length} player${selected.length !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </PageMain>
  );
}

'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { CalendarCheck, History, Play, Plus } from 'lucide-react';
import { startBuyIns } from '@pb/core';

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
  const { data: players = [], error: playersError, mutate } = useSWR('players', fetchPlayers);

  // null until the host types, so the dated default shows without an effect copying it in.
  const defaultName = useDefaultSessionName();
  const [nameDraft, setName] = useState<string | null>(null);
  const name = nameDraft ?? defaultName;
  const [selected, setSelected] = useState<SelectedPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  // The roster can be long; it stays folded until the host searches or asks for all of it.
  const [showAll, setShowAll] = useState(false);
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
    if (starting || !name.trim() || selected.length === 0) return;
    const plan = startBuyIns(selected.map((s) => ({ playerId: s.player.id, cents: parseMoneyInput(s.buyIn) })));
    // Start and Enter in the name field both land here, so a blank buy-in blocks both. The row
    // already says why; focusing it puts the keyboard where the missing amount goes.
    if (plan.kind === 'blank') {
      focusBlankBuyIn();
      return;
    }
    setStarting(true);
    try {
      // One transaction (0002 start_session): a typed 0 seats the player and writes no buy-in
      // row, as the Go-era `parseFloat(s.buyIn) > 0` filter did.
      const sessionId = await writeStartSession(name.trim(), plan.buyIns);
      router.push(`/session/${sessionId}`);
    } catch (e) {
      toast.error((e as Error).message);
      setStarting(false);
    }
  }

  // The page is one form so Enter in the name field starts the night. Every other field
  // handles its own Enter, and every other button is type='button', so nothing else submits.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startSession();
  }

  // Enter in a search picks the first match rather than starting the session half-filled.
  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (search.trim() && filtered[0]) addPlayer(filtered[0]);
  }

  const listShown = showAll || search.trim() !== '';

  return (
    <PageMain className='pb-0'>
      <PageHeader title='New Session' actions={<BackAction fallback='/' />} />

      <form onSubmit={onSubmit} className='space-y-6'>
        <div>
          <label htmlFor='session-name' className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>Session name</label>
          <Input
            id='session-name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='h-11'
            placeholder='Poker — Fri Oct 3'
            enterKeyHint='go'
          />
        </div>

        <div>
          <label htmlFor='default-buy-in' className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>Default buy-in</label>
          <MoneyInput
            id='default-buy-in'
            value={defaultBuyIn}
            onValueChange={setDefaultBuyIn}
            onKeyDown={blockEnter}
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
              <Button type='button' variant='outline' className='h-11 text-xs tracking-widest uppercase' onClick={() => addPlayers(lastTime)}>
                <History aria-hidden='true' />
                Same players as last time ({lastTime.length})
              </Button>
            )}
            {tonight && tonight.players.length > 0 && (
              <Button type='button' variant='outline' className='h-11 text-xs tracking-widest uppercase' onClick={() => addPlayers(tonight.players)}>
                <CalendarCheck aria-hidden='true' />
                Tonight&apos;s yes RSVPs ({tonight.players.length})
              </Button>
            )}
          </div>
        )}

        {selected.length > 0 && (
          <section aria-labelledby='seated-heading'>
            <h2 id='seated-heading' className='text-xs tracking-widest uppercase text-muted-foreground mb-2'>
              Players ({selected.length})
            </h2>
            <div className='border border-border rounded-md divide-y divide-border'>
              {selected.map(({ player, buyIn }) => {
                const blank = parseMoneyInput(buyIn) === null;
                const hintId = `buy-in-blank-${player.id}`;
                return (
                  <div key={player.id} className='pl-4 pr-1 py-2'>
                    <div className='flex items-center gap-3'>
                      <span className='flex-1 text-sm font-medium truncate'>{player.name}</span>
                      <MoneyInput
                        value={buyIn}
                        onValueChange={(value) => updateBuyIn(player.id, value)}
                        onKeyDown={blockEnter}
                        aria-label={`${player.name}'s buy-in`}
                        aria-invalid={blank || undefined}
                        aria-describedby={blank ? hintId : undefined}
                        data-buy-in-blank={blank || undefined}
                        containerClassName='w-24 shrink-0'
                        className='text-right pr-2'
                      />
                      <button
                        type='button'
                        onClick={() => removePlayer(player.id)}
                        aria-label={`Remove ${player.name}`}
                        className='size-11 flex items-center justify-center shrink-0 rounded text-muted-foreground hover:text-destructive transition-colors text-lg leading-none'
                      >
                        <span aria-hidden='true'>×</span>
                      </button>
                    </div>
                    {blank && <p id={hintId} className='text-xs text-destructive pb-1'>Enter a buy-in, or 0 for none</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div>
          <label htmlFor='player-search' className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>
            {selected.length > 0 ? 'Add more players' : 'Add players'}
          </label>
          <Input
            id='player-search'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            className='h-11 mb-2'
            placeholder='Search players…'
            enterKeyHint='search'
          />
          {playersError ? (
            <div role='alert' className='flex items-center justify-between gap-3 border border-destructive/60 rounded-md px-4 py-2'>
              <p className='text-xs text-destructive'>Couldn&apos;t load your players: {(playersError as Error).message}</p>
              <Button type='button' variant='outline' className='h-11 shrink-0 text-xs tracking-widest uppercase' onClick={() => mutate()}>
                Retry
              </Button>
            </div>
          ) : listShown ? (
            filtered.length > 0 && (
              <div className='border border-border rounded-md divide-y divide-border'>
                {filtered.map((p) => (
                  <button
                    type='button'
                    key={p.id}
                    onClick={() => addPlayer(p)}
                    className='w-full text-left px-4 py-3 text-sm hover:bg-secondary transition-colors min-h-[44px]'
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )
          ) : (
            filtered.length > 0 && (
              <Button type='button' variant='outline' className='w-full h-11 text-xs tracking-widest uppercase' onClick={() => setShowAll(true)}>
                Show all players ({filtered.length})
              </Button>
            )
          )}
        </div>

        <div>
          <label htmlFor='new-player-name' className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>New player</label>
          <div className='flex gap-2'>
            <Input
              id='new-player-name'
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                addNewPlayer();
              }}
              className='h-11'
              placeholder='Name'
              enterKeyHint='done'
            />
            <Button
              type='button'
              onClick={addNewPlayer}
              disabled={creating || !newPlayerName.trim()}
              className='h-11 px-5 shrink-0 text-sm tracking-widest'
              aria-label='Add player'
            >
              <Plus aria-hidden='true' />
            </Button>
          </div>
        </div>

        {/* Sticky so Start never sits below a long roster. The route has no nav bar, so the bar
            clears the home indicator itself. */}
        <div className='sticky bottom-0 z-10 -mx-6 border-t border-border bg-background/95 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur'>
          <Button
            type='submit'
            size='lg'
            className='w-full h-12 text-xs tracking-widest uppercase'
            disabled={starting || !name.trim() || selected.length === 0}
          >
            <Play aria-hidden='true' />
            {starting ? 'Starting…' : `Start Session · ${selected.length} player${selected.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </form>
    </PageMain>
  );
}

// A buy-in field inside the form: Enter would otherwise submit and start the night mid-edit.
function blockEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.preventDefault();
}

function focusBlankBuyIn() {
  document.querySelector<HTMLInputElement>('[data-buy-in-blank]')?.focus();
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { formatCents, isSettled } from '@pb/core';
import { Link2 } from 'lucide-react';
import { DataState } from '@/components/shared/data-state';
import { HeaderAction, PageHeader, PageMain } from '@/components/shared/layout/page';
import { playerBalanceCents, sumCents } from '@/lib/ledger';
import { isPlayerArchived } from '@/lib/supabase/player-admin';
import { fetchBuyIns, fetchCashouts, fetchOrders, fetchPayments, fetchPlayers, type PlayerRow } from '@/lib/supabase/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { AddPlayerForm } from './_list/add-player-form';
import { lastPlayedByPlayer, type BalanceFilter, type PlayerListRow } from './_list/player-list';
import { usePlayerFilters } from './_list/use-player-filters';

const FILTERS: { value: BalanceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'owes', label: 'Owes' },
  { value: 'owed', label: 'Owed' },
  { value: 'even', label: 'Even' },
];

export default function PlayersPage() {
  const router = useRouter();
  const { data: players, error, mutate } = useSWR<PlayerRow[], Error>('players', fetchPlayers);
  const { data: orders = [] }   = useSWR('orders', fetchOrders);
  const { data: buyIns = [] }   = useSWR('buy_ins', fetchBuyIns);
  const { data: cashouts = [] } = useSWR('cashouts', fetchCashouts);
  const { data: payments = [] } = useSWR('payments', fetchPayments);

  const [adding, setAdding] = useState(false);

  // Last played comes from the buy-ins and cash-outs already loaded for the balances: a
  // player's newest one is the last night they sat down. No session read is added for it.
  const lastPlayed = lastPlayedByPlayer([...buyIns, ...cashouts]);
  const playerRows: PlayerListRow<PlayerRow>[] = (players ?? [])
    .map((player) => ({
      player,
      balanceCents: playerBalanceCents(player.id, orders, buyIns, cashouts, payments),
      archived: isPlayerArchived(player),
      lastPlayedAt: lastPlayed.get(player.id),
    }))
    .sort((a, b) => b.balanceCents - a.balanceCents);

  const view = usePlayerFilters(playerRows);
  const totalOwedCents = sumCents(playerRows.filter((r) => r.balanceCents > 0), (r) => r.balanceCents);

  return (
    <PageMain>
      <PageHeader
        title='Players'
        subtitle={totalOwedCents > 0 ? `$${formatCents(totalOwedCents)} outstanding` : undefined}
        actions={<HeaderAction onClick={() => { setAdding(true); }}>+ Add</HeaderAction>}
      />

      <Button asChild variant='outline' className='w-full h-11 text-xs tracking-widest uppercase mb-4'>
        <Link href='/invites'>
          <Link2 aria-hidden='true' />
          Send Invite Link
        </Link>
      </Button>

      {adding && (
        <AddPlayerForm
          existingNames={(players ?? []).map((p) => p.name)}
          onAdded={() => void mutate()}
          onClose={() => setAdding(false)}
        />
      )}

      <DataState rows={players} error={error} onRetry={() => void mutate()} empty={adding ? null : <NoPlayers />}>
        {() => (
          <>
            <Input
              type='search'
              value={view.query}
              onChange={(e) => view.setQuery(e.target.value)}
              placeholder='Search players'
              aria-label='Search players'
              className='h-11 mb-3'
            />
            <FilterBar value={view.filter} onChange={view.setFilter} />
            {view.visible.length === 0 && (
              <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>No players match</p>
            )}
            <div className='space-y-2'>
              {view.visible.map((row) => (
                <PlayerRowButton key={row.player.id} row={row} onOpen={() => router.push(`/players/${row.player.id}`)} />
              ))}
            </div>
            {view.hiddenCount > 0 && (
              <button
                type='button'
                aria-pressed={view.showArchived}
                onClick={() => view.setShowArchived(!view.showArchived)}
                className='mt-6 mx-auto block min-h-11 px-4 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
              >
                {view.showArchived ? 'Hide archived' : `Show archived (${view.hiddenCount})`}
              </button>
            )}
          </>
        )}
      </DataState>
    </PageMain>
  );
}

function FilterBar({ value, onChange }: { value: BalanceFilter; onChange: (next: BalanceFilter) => void }) {
  return (
    <div className='flex flex-wrap gap-2 mb-4'>
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type='button'
          aria-pressed={value === f.value}
          onClick={() => onChange(f.value)}
          className={`h-11 px-4 rounded-full border text-xs tracking-widest uppercase transition-colors ${
            value === f.value ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function shortDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PlayerRowButton({ row, onOpen }: { row: PlayerListRow<PlayerRow>; onOpen: () => void }) {
  const { player, balanceCents, archived, lastPlayedAt } = row;
  return (
    <button
      onClick={onOpen}
      className='w-full min-h-11 text-left border border-border rounded-md px-4 py-4 hover:border-primary/50 transition-colors'
    >
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2 min-w-0'>
            <span className='text-sm font-medium truncate'>{player.name}</span>
            {archived && (
              <span className='shrink-0 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded border border-border text-muted-foreground'>
                Archived
              </span>
            )}
          </div>
          {lastPlayedAt && <p className='text-xs text-muted-foreground mt-0.5'>Last played {shortDate(lastPlayedAt)}</p>}
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          {isSettled(balanceCents) ? (
            <span className='text-xs tracking-widest uppercase text-muted-foreground'>Even</span>
          ) : balanceCents > 0 ? (
            <span className='text-sm font-semibold text-destructive tabular-nums'>${formatCents(balanceCents)} owes you</span>
          ) : (
            <span className='text-sm font-semibold text-green-500 tabular-nums'>You owe ${formatCents(Math.abs(balanceCents))}</span>
          )}
          <span className='text-primary text-xs'>›</span>
        </div>
      </div>
    </button>
  );
}

function NoPlayers() {
  return <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>No players yet</p>;
}

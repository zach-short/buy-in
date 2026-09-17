'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { fetcher, apiFetch, computeBalance, Player, Order, BuyIn, Cashout, Payment } from '@/lib/bar-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function PlayersPage() {
  const router = useRouter();
  const { data: players = [], isLoading, mutate } = useSWR<Player[]>('/api/players', fetcher);
  const { data: orders = [] }   = useSWR<Order[]>('/api/orders', fetcher);
  const { data: buyIns = [] }   = useSWR<BuyIn[]>('/api/buyins', fetcher);
  const { data: cashouts = [] } = useSWR<Cashout[]>('/api/cashouts', fetcher);
  const { data: payments = [] } = useSWR<Payment[]>('/api/payments', fetcher);

  const [adding, setAdding] = useState(false);
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [venmo, setVenmo]   = useState('');
  const [saving, setSaving] = useState(false);

  const playerRows = players
    .map((player) => ({ player, balance: computeBalance(player.id, orders, buyIns, cashouts, payments) }))
    .sort((a, b) => b.balance - a.balance);

  const totalOwed = playerRows.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiFetch<Player>('/api/players', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), venmo: venmo.trim() }),
      });
      toast.success(`${name.trim()} added`);
      mutate();
      setAdding(false);
      setName(''); setPhone(''); setVenmo('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className='min-h-screen px-6 py-10 max-w-sm mx-auto'>
      <div className='flex items-center justify-between mb-10'>
        <div>
          <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Players</h1>
          {totalOwed > 0 && (
            <p className='text-xs text-muted-foreground mt-0.5'>${totalOwed.toFixed(2)} outstanding</p>
          )}
        </div>
        <div className='flex items-center gap-4'>
          <button
            onClick={() => { setAdding(true); }}
            className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
          >
            + Add
          </button>
          <button
            onClick={() => router.back()}
            className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
          >
            Back
          </button>
        </div>
      </div>

      {adding && (
        <div className='border border-border rounded-md p-4 mb-6 space-y-3'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground'>New Player</p>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder='Name'
            className='h-11'
          />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder='Phone (e.g. +15551234567)'
            type='tel'
            className='h-11'
          />
          <Input
            value={venmo}
            onChange={(e) => setVenmo(e.target.value)}
            placeholder='Venmo handle (e.g. @john-doe)'
            className='h-11'
          />
          <div className='flex gap-2'>
            <Button variant='outline' className='flex-1 h-10 text-xs tracking-widest uppercase' onClick={() => { setAdding(false); setName(''); setPhone(''); setVenmo(''); }} disabled={saving}>Cancel</Button>
            <Button className='flex-1 h-10 text-xs tracking-widest uppercase' onClick={handleAdd} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Add Player'}</Button>
          </div>
        </div>
      )}

      {isLoading && (
        <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>Loading…</p>
      )}

      {!isLoading && players.length === 0 && !adding && (
        <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>No players yet</p>
      )}

      <div className='space-y-2'>
        {playerRows.map(({ player, balance }) => (
          <button
            key={player.id}
            onClick={() => router.push(`/players/${player.id}`)}
            className='w-full text-left border border-border rounded-md px-4 py-4 hover:border-primary/50 transition-colors'
          >
            <div className='flex items-center justify-between gap-3'>
              <span className='text-sm font-medium'>{player.name}</span>
              <div className='flex items-center gap-2 shrink-0'>
                {Math.abs(balance) < 0.01 ? (
                  <span className='text-xs tracking-widest uppercase text-muted-foreground'>Even</span>
                ) : balance > 0 ? (
                  <span className='text-sm font-semibold text-destructive tabular-nums'>${balance.toFixed(2)} owes you</span>
                ) : (
                  <span className='text-sm font-semibold text-green-500 tabular-nums'>You owe ${Math.abs(balance).toFixed(2)}</span>
                )}
                <span className='text-primary text-xs'>›</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  fetcher,
  apiFetch,
  computeBalance,
  openVenmo,
  formatDate,
  formatTime,
  Player,
  Session,
  Order,
  BuyIn,
  Cashout,
  Payment,
} from '@/lib/bar-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function BalanceLabel({ amount }: { amount: number }) {
  if (Math.abs(amount) < 0.01)
    return (
      <span className='text-3xl font-bold text-muted-foreground'>Even</span>
    );
  if (amount > 0)
    return (
      <div className='text-center'>
        <p className='text-3xl font-bold text-destructive'>
          ${amount.toFixed(2)}
        </p>
        <p className='text-xs text-muted-foreground tracking-widest uppercase mt-1'>
          They owe you
        </p>
      </div>
    );
  return (
    <div className='text-center'>
      <p className='text-3xl font-bold text-green-500'>
        ${Math.abs(amount).toFixed(2)}
      </p>
      <p className='text-xs text-muted-foreground tracking-widest uppercase mt-1'>
        You owe them
      </p>
    </div>
  );
}

export default function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: players = [], mutate: mutatePlayers } = useSWR<Player[]>(
    '/api/players',
    fetcher,
  );
  const player = players.find((p) => p.id === id);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editVenmo, setEditVenmo] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  function openEdit() {
    setEditName(player?.name ?? '');
    setEditPhone(player?.phone ?? '');
    setEditVenmo(player?.venmo ?? '');
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/players/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
          venmo: editVenmo.trim(),
        }),
      });
      mutatePlayers();
      setEditing(false);
      toast.success('Saved');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  }

  function handlePayVenmo() {
    if (!player?.venmo || balance >= 0) return;
    openVenmo(player.venmo, Math.abs(balance));
  }

  const { data: sessions = [] } = useSWR<Session[]>('/api/sessions', fetcher);
  const { data: orders = [] } = useSWR<Order[]>('/api/orders', fetcher);
  const { data: buyIns = [] } = useSWR<BuyIn[]>('/api/buyins', fetcher);
  const { data: cashouts = [] } = useSWR<Cashout[]>('/api/cashouts', fetcher);
  const { data: payments = [], mutate: mutatePayments } = useSWR<Payment[]>(
    `/api/payments?playerId=${id}`,
    fetcher,
  );

  const balance = computeBalance(id, orders, buyIns, cashouts, payments);

  const [paymentMode, setPaymentMode] = useState<'received' | 'sent' | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleRequestReceipt() {
    if (!player?.phone) return;
    const { token } = await apiFetch<{ token: string }>(`/api/players/${id}/portal-token`);
    const url = `${window.location.origin}/player-receipt/${id}/${token}`;
    window.location.href = `sms:${player.phone}&body=${encodeURIComponent(url)}`;
  }

  async function handlePayment() {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0 || !paymentMode) return;
    setSaving(true);
    try {
      await apiFetch<Payment>('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          playerId: id,
          amount,
          note: paymentNote.trim(),
          direction: paymentMode,
        }),
      });
      toast.success(
        paymentMode === 'received' ? 'Payment recorded' : 'Payout recorded',
      );
      mutatePayments();
      setPaymentMode(null);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const sessionGroups = sessions
    .filter((s) =>
      orders.some((o) => o.sessionId === s.id && o.playerId === id) ||
      buyIns.some((b) => b.sessionId === s.id && b.playerId === id),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((session) => {
      const sessionOrders = orders
        .filter((o) => o.sessionId === session.id && o.playerId === id)
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
      const sessionBuyIns = buyIns.filter(
        (b) => b.sessionId === session.id && b.playerId === id,
      );
      const sessionCashout = cashouts.find(
        (c) => c.sessionId === session.id && c.playerId === id,
      );
      const drinkTotal = sessionOrders.reduce((s, o) => s + o.price, 0);
      const buyInTotal = sessionBuyIns.reduce((s, b) => s + b.amount, 0);
      const cashoutAmount = sessionCashout?.amount ?? 0;
      const sessionNet = drinkTotal + buyInTotal - cashoutAmount;
      return {
        session,
        sessionOrders,
        sessionBuyIns,
        drinkTotal,
        buyInTotal,
        cashoutAmount,
        sessionNet,
      };
    });

  const paymentHistory = [...payments].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  if (!player) {
    return (
      <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
        Loading…
      </div>
    );
  }

  return (
    <main className='min-h-screen px-6 py-10 max-w-sm mx-auto pb-32'>
      <div className='flex items-center justify-between mb-10'>
        <div>
          <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>
            {player.name}
          </h1>
          {player.phone && (
            <p className='text-xs text-muted-foreground mt-0.5'>
              {player.phone}
            </p>
          )}
        </div>
        <div className='flex items-center gap-4'>
          <button
            onClick={async () => {
              const { token } = await apiFetch<{ token: string }>(
                `/api/players/${id}/portal-token`,
              );
              const url = `${window.location.origin}/portal/${id}/${token}`;
              await navigator.clipboard.writeText(url);
              toast.success('Portal link copied');
            }}
            className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
          >
            Portal
          </button>
          <button
            onClick={openEdit}
            className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
          >
            Edit
          </button>
          <button
            onClick={() => router.back()}
            className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
          >
            Back
          </button>
        </div>
      </div>

      {editing && (
        <div className='border border-border rounded-md p-4 mb-8 space-y-3'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground'>
            Edit Player
          </p>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className='h-11'
            placeholder='Name'
            autoFocus
          />
          <Input
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            className='h-11'
            placeholder='Phone (e.g. +15551234567)'
            type='tel'
          />
          <Input
            value={editVenmo}
            onChange={(e) => setEditVenmo(e.target.value)}
            className='h-11'
            placeholder='Venmo handle (e.g. @john-doe)'
          />
          <div className='flex gap-2'>
            <Button
              variant='outline'
              className='flex-1 h-10 text-xs tracking-widest uppercase'
              onClick={() => setEditing(false)}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button
              className='flex-1 h-10 text-xs tracking-widest uppercase'
              onClick={handleSaveEdit}
              disabled={savingEdit || !editName.trim()}
            >
              {savingEdit ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <div className='border border-border rounded-md p-6 mb-8 flex flex-col items-center gap-2'>
        <p className='text-xs tracking-widest uppercase text-muted-foreground mb-2'>
          Running Balance
        </p>
        <BalanceLabel amount={balance} />
      </div>

      {paymentMode === null ? (
        <div className='space-y-3 mb-8'>
          <div className='flex gap-3'>
            <button
              onClick={() => {
                setPaymentMode('received');
                setPaymentAmount(balance > 0 ? balance.toFixed(2) : '');
              }}
              className='flex-1 py-3 border border-border rounded text-xs tracking-widest uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors'
            >
              They Paid Me
            </button>
            <button
              onClick={() => {
                setPaymentMode('sent');
                setPaymentAmount(balance < 0 ? Math.abs(balance).toFixed(2) : '');
              }}
              className='flex-1 py-3 border border-border rounded text-xs tracking-widest uppercase text-muted-foreground hover:border-green-500 hover:text-green-500 transition-colors'
            >
              I Paid Them
            </button>
            {player.venmo && balance < 0 && (
              <button
                onClick={handlePayVenmo}
                className='flex-1 py-3 rounded text-xs tracking-widest uppercase font-semibold text-white transition-opacity hover:opacity-90'
                style={{ background: '#3D95CE' }}
              >
                Pay
              </button>
            )}
          </div>
          {player.phone && (
            <button
              onClick={handleRequestReceipt}
              className='w-full py-3 border border-border rounded text-xs tracking-widest uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors'
            >
              Request · Text Full History
            </button>
          )}
        </div>
      ) : (
        <div className='border border-border rounded-md p-4 mb-8 space-y-3'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground'>
            {paymentMode === 'received'
              ? 'Record Payment Received'
              : 'Record Payout Sent'}
          </p>
          <div className='relative'>
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm'>
              $
            </span>
            <Input
              type='number'
              min='0'
              step='0.01'
              autoFocus
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className='h-11 pl-7'
              placeholder='0.00'
            />
          </div>
          <Input
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            className='h-11'
            placeholder='Note (optional)'
          />
          <div className='flex gap-2'>
            <Button
              variant='outline'
              className='flex-1 h-10 text-xs tracking-widest uppercase'
              onClick={() => setPaymentMode(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className='flex-1 h-10 text-xs tracking-widest uppercase'
              onClick={handlePayment}
              disabled={saving || !paymentAmount}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {sessionGroups.length > 0 && (
        <div className='space-y-4 mb-8'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground'>
            Session History
          </p>
          {sessionGroups.map(
            ({
              session,
              sessionOrders,
              sessionBuyIns,
              drinkTotal,
              buyInTotal,
              cashoutAmount,
              sessionNet,
            }) => (
              <div key={session.id} className='border border-border rounded-md'>
                <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
                  <div>
                    <p className='text-sm font-medium'>{session.name}</p>
                    <p className='text-xs text-muted-foreground'>
                      {formatDate(session.date)}
                    </p>
                  </div>
                  <div className='text-right'>
                    <p
                      className={`text-sm font-semibold ${sessionNet > 0 ? 'text-destructive' : sessionNet < 0 ? 'text-green-500' : 'text-muted-foreground'}`}
                    >
                      {sessionNet > 0
                        ? `+$${sessionNet.toFixed(2)}`
                        : sessionNet < 0
                          ? `-$${Math.abs(sessionNet).toFixed(2)}`
                          : 'Even'}
                    </p>
                    <p className='text-xs text-muted-foreground'>net</p>
                  </div>
                </div>

                <div className='px-4 py-3 space-y-1.5 text-sm'>
                  {sessionBuyIns.map((b, i) => (
                    <div
                      key={b.id}
                      className='flex justify-between text-muted-foreground'
                    >
                      <span>{i === 0 ? 'Buy-in' : 'Re-buy'}</span>
                      <span className='tabular-nums'>
                        +${b.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {sessionOrders.map((order) => (
                    <div key={order.id} className='flex justify-between'>
                      <span className='text-muted-foreground truncate pr-2'>
                        {order.drinkName}{' '}
                        <span className='text-xs opacity-60'>
                          {formatTime(order.timestamp)}
                        </span>
                      </span>
                      <span className='tabular-nums shrink-0'>
                        +${order.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {cashoutAmount > 0 && (
                    <div className='flex justify-between text-green-500'>
                      <span>Cashout</span>
                      <span className='tabular-nums'>
                        −${cashoutAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className='flex justify-between font-medium pt-1 border-t border-border mt-1'>
                    <span>Session total</span>
                    <span className='tabular-nums'>
                      ${(drinkTotal + buyInTotal).toFixed(2)} in · $
                      {cashoutAmount.toFixed(2)} out
                    </span>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {paymentHistory.length > 0 && (
        <div className='space-y-2'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground'>
            Payment History
          </p>
          {paymentHistory.map((p) => (
            <div
              key={p.id}
              className='flex items-center justify-between py-2.5 border-b border-border last:border-0'
            >
              <div>
                <p className='text-sm'>
                  {p.direction === 'received' ? 'Paid you' : 'You paid them'}
                </p>
                {p.note && (
                  <p className='text-xs text-muted-foreground'>{p.note}</p>
                )}
                <p className='text-xs text-muted-foreground'>
                  {formatDate(p.timestamp)}
                </p>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${p.direction === 'received' ? 'text-green-500' : 'text-destructive'}`}
              >
                {p.direction === 'received' ? '−' : '+'}${p.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {sessionGroups.length === 0 && paymentHistory.length === 0 && (
        <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>
          No history yet
        </p>
      )}
    </main>
  );
}

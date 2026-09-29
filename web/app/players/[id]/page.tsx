'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { formatCents, formatDate, formatTime, isSettled, toCents, DEFAULT_VENMO_NOTE, venmoUrls } from '@pb/core';
import { openVenmo } from '@/lib/venmo';
import { playerBalanceCents, sumCents } from '@/lib/ledger';
import {
  fetchBuyIns,
  fetchCashouts,
  fetchOrders,
  fetchPlayerPayments,
  fetchPlayers,
  fetchSessions,
} from '@/lib/supabase/queries';
import { createPayment, updatePlayer } from '@/lib/supabase/writes';
import {
  playerReceiptUrl, portalUrl, replacePortalToken, shareToken,
} from '@/lib/supabase/share-links';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function BalanceLabel({ cents }: { cents: number }) {
  if (isSettled(cents))
    return (
      <span className='text-3xl font-bold text-muted-foreground'>Even</span>
    );
  if (cents > 0)
    return (
      <div className='text-center'>
        <p className='text-3xl font-bold text-destructive'>
          ${formatCents(cents)}
        </p>
        <p className='text-xs text-muted-foreground tracking-widest uppercase mt-1'>
          They owe you
        </p>
      </div>
    );
  return (
    <div className='text-center'>
      <p className='text-3xl font-bold text-green-500'>
        ${formatCents(Math.abs(cents))}
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

  const { data: players = [], mutate: mutatePlayers } = useSWR(
    'players',
    fetchPlayers,
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
      await updatePlayer(id, { name: editName.trim(), phone: editPhone.trim(), venmo: editVenmo.trim() });
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
    if (!player?.venmo || balanceCents >= 0) return;
    // The house owes this player, so the host pays the player's own handle. A whole balance
    // gets the plain default note (owner, 2026-09-27), never the amount. The host's template
    // is worded for players paying the house, so it is not applied to the house paying out.
    openVenmo(venmoUrls(player.venmo, balanceCents, DEFAULT_VENMO_NOTE));
  }

  const { data: sessions = [] } = useSWR('sessions', fetchSessions);
  const { data: orders = [] } = useSWR('orders', fetchOrders);
  const { data: buyIns = [] } = useSWR('buy_ins', fetchBuyIns);
  const { data: cashouts = [] } = useSWR('cashouts', fetchCashouts);
  const { data: payments = [], mutate: mutatePayments } = useSWR(
    ['payments', id],
    ([, playerId]) => fetchPlayerPayments(playerId),
  );

  const balanceCents = playerBalanceCents(id, orders, buyIns, cashouts, payments);

  const [paymentMode, setPaymentMode] = useState<'received' | 'sent' | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleRequestReceipt() {
    if (!player?.phone) return;
    try {
      const url = playerReceiptUrl(await shareToken(player, null));
      window.location.href = `sms:${player.phone}&body=${encodeURIComponent(url)}`;
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function copyPortalLink(replace: boolean) {
    if (!player) return;
    // Replacing revokes every portal link this player holds — the ones already texted stop
    // working (D8's revocability, owner's answer 2026-09-27).
    if (replace && !window.confirm(`Replace ${player.name}'s portal link? The old one stops working.`)) return;
    try {
      const token = replace ? await replacePortalToken(player) : await shareToken(player, null);
      await navigator.clipboard.writeText(portalUrl(token));
      toast.success(replace ? 'New portal link copied' : 'Portal link copied');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handlePayment() {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0 || !paymentMode || !player) return;
    setSaving(true);
    try {
      await createPayment(player, toCents(amount), paymentNote.trim(), paymentMode);
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
      orders.some((o) => o.session_id === s.id && o.player_id === id) ||
      buyIns.some((b) => b.session_id === s.id && b.player_id === id),
    )
    .sort((a, b) => new Date(b.played_on).getTime() - new Date(a.played_on).getTime())
    .map((session) => {
      const sessionOrders = orders
        .filter((o) => o.session_id === session.id && o.player_id === id)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      const sessionBuyIns = buyIns.filter(
        (b) => b.session_id === session.id && b.player_id === id,
      );
      const sessionCashout = cashouts.find(
        (c) => c.session_id === session.id && c.player_id === id,
      );
      const drinkTotalCents = sumCents(sessionOrders, (o) => o.price_cents);
      const buyInTotalCents = sumCents(sessionBuyIns, (b) => b.amount_cents);
      const cashoutCents = sessionCashout?.amount_cents ?? 0;
      const sessionNetCents = drinkTotalCents + buyInTotalCents - cashoutCents;
      return {
        session,
        sessionOrders,
        sessionBuyIns,
        drinkTotalCents,
        buyInTotalCents,
        cashoutCents,
        sessionNetCents,
      };
    });

  const paymentHistory = [...payments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  if (!player) {
    return (
      <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
        Loading…
      </div>
    );
  }

  return (
    <main className='min-h-screen px-6 py-10 max-w-3xl mx-auto pb-32'>
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
            onClick={() => copyPortalLink(false)}
            className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
          >
            Portal
          </button>
          <button
            onClick={() => copyPortalLink(true)}
            className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
          >
            New link
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
        <BalanceLabel cents={balanceCents} />
      </div>

      {paymentMode === null ? (
        <div className='space-y-3 mb-8'>
          <div className='flex gap-3'>
            <button
              onClick={() => {
                setPaymentMode('received');
                setPaymentAmount(balanceCents > 0 ? formatCents(balanceCents) : '');
              }}
              className='flex-1 py-3 border border-border rounded text-xs tracking-widest uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors'
            >
              They Paid Me
            </button>
            <button
              onClick={() => {
                setPaymentMode('sent');
                setPaymentAmount(balanceCents < 0 ? formatCents(Math.abs(balanceCents)) : '');
              }}
              className='flex-1 py-3 border border-border rounded text-xs tracking-widest uppercase text-muted-foreground hover:border-green-500 hover:text-green-500 transition-colors'
            >
              I Paid Them
            </button>
            {player.venmo && balanceCents < 0 && (
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
              drinkTotalCents,
              buyInTotalCents,
              cashoutCents,
              sessionNetCents,
            }) => (
              <div key={session.id} className='border border-border rounded-md'>
                <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
                  <div>
                    <p className='text-sm font-medium'>{session.name}</p>
                    <p className='text-xs text-muted-foreground'>
                      {formatDate(session.played_on)}
                    </p>
                  </div>
                  <div className='text-right'>
                    <p
                      className={`text-sm font-semibold ${sessionNetCents > 0 ? 'text-destructive' : sessionNetCents < 0 ? 'text-green-500' : 'text-muted-foreground'}`}
                    >
                      {sessionNetCents > 0
                        ? `+$${formatCents(sessionNetCents)}`
                        : sessionNetCents < 0
                          ? `-$${formatCents(Math.abs(sessionNetCents))}`
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
                        +${formatCents(b.amount_cents)}
                      </span>
                    </div>
                  ))}
                  {sessionOrders.map((order) => (
                    <div key={order.id} className='flex justify-between'>
                      <span className='text-muted-foreground truncate pr-2'>
                        {order.drink_name}{' '}
                        <span className='text-xs opacity-60'>
                          {formatTime(order.created_at)}
                        </span>
                      </span>
                      <span className='tabular-nums shrink-0'>
                        +${formatCents(order.price_cents)}
                      </span>
                    </div>
                  ))}
                  {cashoutCents > 0 && (
                    <div className='flex justify-between text-green-500'>
                      <span>Cashout</span>
                      <span className='tabular-nums'>
                        −${formatCents(cashoutCents)}
                      </span>
                    </div>
                  )}
                  <div className='flex justify-between font-medium pt-1 border-t border-border mt-1'>
                    <span>Session total</span>
                    <span className='tabular-nums'>
                      ${formatCents(drinkTotalCents + buyInTotalCents)} in · $
                      {formatCents(cashoutCents)} out
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
                  {formatDate(p.created_at)}
                </p>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${p.direction === 'received' ? 'text-green-500' : 'text-destructive'}`}
              >
                {p.direction === 'received' ? '−' : '+'}${formatCents(p.amount_cents)}
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

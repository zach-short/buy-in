'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { DEFAULT_VENMO_NOTE, venmoUrls } from '@pb/core';
import { BackAction } from '@/components/shared/layout/back-action';
import { HeaderAction, PageHeader, PageMain } from '@/components/shared/layout/page';
import { StatusScreen } from '@/components/shared/status-screen';
import { openVenmo } from '@/lib/venmo';
import { playerBalanceCents } from '@/lib/ledger';
import {
  fetchBuyIns,
  fetchCashouts,
  fetchOrders,
  fetchPlayerPayments,
  fetchPlayers,
  fetchSessions,
} from '@/lib/supabase/queries';
import { useConfirm } from '@/hooks/use-confirm';
import { PlayerAccountPanel } from '@/components/players/player-account-panel';
import { BalanceLabel } from '@/components/players/balance-label';
import { PaymentHistory } from '@/components/players/payment-history';
import { PlayerAdminPanel } from '@/components/players/player-admin-panel';
import { PlayerEditForm } from '@/components/players/player-edit-form';
import { RecordPaymentForm, type PaymentMode } from '@/components/players/record-payment-form';
import { ReportedPayments } from '@/components/players/reported-payments';
import { SessionHistory, sessionGroupsFor } from '@/components/players/session-history';
import { usePlayerLinks } from '@/components/players/use-player-links';

const OUTLINE_ACTION = 'flex-1 min-h-11 py-3 border border-border rounded text-xs tracking-widest uppercase text-muted-foreground transition-colors';

export default function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { confirm, confirmDialog } = useConfirm();

  const { data: players, error: playersError, mutate: mutatePlayers } = useSWR(
    'players',
    fetchPlayers,
  );
  const player = players?.find((p) => p.id === id);
  const links = usePlayerLinks(player, confirm);

  const [editing, setEditing] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);

  const { data: sessions = [] } = useSWR('sessions', fetchSessions);
  const { data: orders } = useSWR('orders', fetchOrders);
  const { data: buyIns } = useSWR('buy_ins', fetchBuyIns);
  const { data: cashouts } = useSWR('cashouts', fetchCashouts);
  const { data: payments, mutate: mutatePayments } = useSWR(
    ['payments', id],
    ([, playerId]) => fetchPlayerPayments(playerId),
  );

  // Null until every list the balance sums has loaded. A balance over a missing list is wrong
  // (it leaves payments out and overstates the debt), and a host acting on it could record the
  // same payment twice, so nothing that shows or acts on a balance renders before then.
  const ledger = orders && buyIns && cashouts && payments ? { orders, buyIns, cashouts, payments } : null;
  const balanceCents = ledger
    ? playerBalanceCents(id, ledger.orders, ledger.buyIns, ledger.cashouts, ledger.payments)
    : null;

  function handlePayVenmo() {
    if (!player?.venmo || balanceCents === null || balanceCents >= 0) return;
    // The house owes this player, so the host pays the player's own handle. A whole balance
    // gets the plain default note (owner, 2026-09-27), never the amount. The host's template
    // is worded for players paying the house, so it is not applied to the house paying out.
    openVenmo(venmoUrls(player.venmo, balanceCents, DEFAULT_VENMO_NOTE));
  }

  const sessionGroups = ledger ? sessionGroupsFor(id, { sessions, ...ledger }) : [];

  const paymentHistory = [...(payments ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  if (!player) {
    // Loaded and absent: a wrong or old link, a merged-away or deleted player, or another bar's.
    if (players) return <StatusScreen kind='empty' title='Player not found' action={{ label: 'All players', href: '/players' }} />;
    if (playersError) return <StatusScreen kind='error' message={(playersError as Error).message} action={{ label: 'Try again', onClick: () => void mutatePlayers() }} />;
    return <StatusScreen kind='loading' />;
  }

  return (
    <PageMain>
      <PageHeader
        title={player.name}
        subtitle={player.phone}
        actions={
          <>
            <HeaderAction onClick={() => links.copyPortalLink(false)}>Portal</HeaderAction>
            <HeaderAction onClick={() => links.copyPortalLink(true)}>New link</HeaderAction>
            <HeaderAction onClick={() => setEditing(true)}>Edit</HeaderAction>
            <BackAction fallback='/players' />
          </>
        }
      />

      {editing && (
        <PlayerEditForm player={player} onSaved={() => void mutatePlayers()} onClose={() => setEditing(false)} />
      )}

      <div className='border border-border rounded-md p-6 mb-8 flex flex-col items-center gap-2'>
        <p className='text-xs tracking-widest uppercase text-muted-foreground mb-2'>
          Running Balance
        </p>
        {balanceCents === null
          ? <span className='text-3xl font-bold text-muted-foreground' aria-label='Loading balance'>…</span>
          : <BalanceLabel cents={balanceCents} />}
      </div>

      <ReportedPayments playerId={id} onLedgerChanged={() => void mutatePayments()} />

      {balanceCents === null ? null : paymentMode === null ? (
        <div className='space-y-3 mb-8'>
          <div className='flex gap-3'>
            <button
              type='button'
              onClick={() => setPaymentMode('received')}
              className={`${OUTLINE_ACTION} hover:border-primary hover:text-primary`}
            >
              They Paid Me
            </button>
            <button
              type='button'
              onClick={() => setPaymentMode('sent')}
              className={`${OUTLINE_ACTION} hover:border-green-500 hover:text-green-500`}
            >
              I Paid Them
            </button>
            {player.venmo && balanceCents < 0 && (
              <button
                type='button'
                onClick={handlePayVenmo}
                className='flex-1 min-h-11 py-3 rounded text-xs tracking-widest uppercase font-semibold text-white transition-opacity hover:opacity-90'
                style={{ background: '#3D95CE' }}
              >
                Pay
              </button>
            )}
          </div>
          {balanceCents > 0 && (
            <button
              type='button'
              onClick={() => void links.remind(balanceCents)}
              className={`w-full ${OUTLINE_ACTION} hover:border-primary hover:text-primary`}
            >
              {player.phone ? 'Remind · Text' : 'Remind · Share'}
            </button>
          )}
          {player.phone && (
            <button
              type='button'
              onClick={() => void links.requestReceipt()}
              className={`w-full ${OUTLINE_ACTION} hover:border-primary hover:text-primary`}
            >
              Request · Text Full History
            </button>
          )}
        </div>
      ) : (
        <RecordPaymentForm
          player={player}
          mode={paymentMode}
          balanceCents={balanceCents}
          onRecorded={() => void mutatePayments()}
          onClose={() => setPaymentMode(null)}
        />
      )}

      <PlayerAccountPanel player={player} players={players ?? []} onChanged={() => mutatePlayers()} />

      <SessionHistory groups={sessionGroups} />

      <PaymentHistory payments={paymentHistory} onChanged={() => void mutatePayments()} />

      {ledger && sessionGroups.length === 0 && paymentHistory.length === 0 && (
        <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>
          No history yet
        </p>
      )}

      {ledger && balanceCents !== null && (
        <div className='mt-8'>
          <PlayerAdminPanel
            player={player}
            players={players ?? []}
            balanceCents={balanceCents}
            ledger={ledger}
            confirm={confirm}
            onRosterChanged={() => void mutatePlayers()}
          />
        </div>
      )}

      {confirmDialog}
    </PageMain>
  );
}

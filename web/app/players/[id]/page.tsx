'use client';

import { use, useMemo, useState } from 'react';
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
  fetchPlayerBuyIns,
  fetchPlayerCashouts,
  fetchPlayerOrders,
  fetchPlayerPayments,
  fetchPlayers,
  fetchSessions,
} from '@/lib/supabase/queries';
import { BALANCE_READ } from '@/lib/swr-options';
import { useConfirm } from '@/hooks/use-confirm';
import { PlayerAccountPanel } from '@/components/players/player-account-panel';
import { BalanceLabel } from '@/components/players/balance-label';
import { PaymentActions } from '@/components/players/payment-actions';
import { PaymentHistory } from '@/components/players/payment-history';
import { PlayerAdminPanel } from '@/components/players/player-admin-panel';
import { PlayerEditForm } from '@/components/players/player-edit-form';
import { PortalLinkPanel } from '@/components/players/portal-link-panel';
import { RecordPaymentForm, type PaymentMode } from '@/components/players/record-payment-form';
import { ReportedPayments } from '@/components/players/reported-payments';
import { SessionHistory, sessionGroupsFor } from '@/components/players/session-history';
import { usePlayerLinks } from '@/components/players/use-player-links';

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
  // Only this player's rows: the balance and the history read nothing else, and
  // orders_player_idx / payments_player_idx serve these where the whole bar's lists did not.
  // A focus refetch leaves an open record-payment form alone: its amount is seeded once, by
  // useState, and SWR keeps the old rows through a failed refetch, so the form never unmounts.
  const { data: orders, error: ordersError, mutate: mutateOrders } = useSWR(['orders', id], ([, playerId]) => fetchPlayerOrders(playerId), BALANCE_READ);
  const { data: buyIns, error: buyInsError, mutate: mutateBuyIns } = useSWR(['buy_ins', id], ([, playerId]) => fetchPlayerBuyIns(playerId), BALANCE_READ);
  const { data: cashouts, error: cashoutsError, mutate: mutateCashouts } = useSWR(['cashouts', id], ([, playerId]) => fetchPlayerCashouts(playerId), BALANCE_READ);
  const { data: payments, error: paymentsError, mutate: mutatePayments } = useSWR(
    ['payments', id],
    ([, playerId]) => fetchPlayerPayments(playerId),
    BALANCE_READ,
  );
  // The merge preview sums the survivor's balance from these (use-merge-player.ts), so they
  // stay whole-bar, on the keys merge revalidates. They gate only the roster panel, never
  // this player's balance. No focus refetch: the preview's fourth list, the survivor's
  // payments, is read in use-merge-player.ts without one, and a preview summed from three
  // fresh lists and one stale list is worse than four equally old ones.
  const { data: barOrders } = useSWR('orders', fetchOrders);
  const { data: barBuyIns } = useSWR('buy_ins', fetchBuyIns);
  const { data: barCashouts } = useSWR('cashouts', fetchCashouts);
  const barLedger = barOrders && barBuyIns && barCashouts
    ? { orders: barOrders, buyIns: barBuyIns, cashouts: barCashouts }
    : null;

  // Null until every list the balance sums has loaded. A balance over a missing list is wrong
  // (it leaves payments out and overstates the debt), and a host acting on it could record the
  // same payment twice, so nothing that shows or acts on a balance renders before then.
  const ledger = orders && buyIns && cashouts && payments ? { orders, buyIns, cashouts, payments } : null;
  const balanceCents = ledger
    ? playerBalanceCents(id, ledger.orders, ledger.buyIns, ledger.cashouts, ledger.payments)
    : null;
  // The app's SWRConfig does not retry on error, so a failed read would leave "…" up forever
  // and hide every payment action. Retry re-reads all four; the balance rule above is unchanged.
  const ledgerError = ordersError ?? buyInsError ?? cashoutsError ?? paymentsError;
  function retryLedger() {
    void mutateOrders();
    void mutateBuyIns();
    void mutateCashouts();
    void mutatePayments();
  }

  function handlePayVenmo() {
    if (!player?.venmo || balanceCents === null || balanceCents >= 0) return;
    // The house owes this player, so the host pays the player's own handle. A whole balance
    // gets the plain default note (owner, 2026-09-27), never the amount. The host's template
    // is worded for players paying the house, so it is not applied to the house paying out.
    openVenmo(venmoUrls(player.venmo, balanceCents, DEFAULT_VENMO_NOTE));
  }

  const sessionGroups = useMemo(
    () => (orders && buyIns && cashouts && payments
      ? sessionGroupsFor(id, { sessions, orders, buyIns, cashouts, payments })
      : []),
    [id, sessions, orders, buyIns, cashouts, payments],
  );

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
        {balanceCents !== null
          ? <BalanceLabel cents={balanceCents} />
          : ledgerError
            ? <LedgerError message={(ledgerError as Error).message} onRetry={retryLedger} />
            : <span className='text-3xl font-bold text-muted-foreground' aria-label='Loading balance'>…</span>}
      </div>

      <ReportedPayments playerId={id} onLedgerChanged={() => void mutatePayments()} />

      {balanceCents === null ? null : paymentMode === null ? (
        <PaymentActions
          balanceCents={balanceCents}
          hasPhone={Boolean(player.phone)}
          canPayVenmo={Boolean(player.venmo) && balanceCents < 0}
          onRecord={setPaymentMode}
          onPayVenmo={handlePayVenmo}
          onRemind={() => void links.remind(balanceCents)}
          onRequest={() => void links.requestReceipt()}
        />
      ) : (
        <RecordPaymentForm
          player={player}
          mode={paymentMode}
          balanceCents={balanceCents}
          onRecorded={() => void mutatePayments()}
          onClose={() => setPaymentMode(null)}
        />
      )}

      <PortalLinkPanel links={links} />

      <SessionHistory groups={sessionGroups} />

      <PaymentHistory payments={paymentHistory} onChanged={() => void mutatePayments()} />

      {ledger && sessionGroups.length === 0 && paymentHistory.length === 0 && (
        <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>
          No history yet
        </p>
      )}

      <div className='mt-8'>
        <PlayerAccountPanel player={player} players={players ?? []} balanceCents={balanceCents} onChanged={() => mutatePlayers()} />
      </div>

      {barLedger && balanceCents !== null && (
        <PlayerAdminPanel
          player={player}
          players={players ?? []}
          balanceCents={balanceCents}
          ledger={barLedger}
          confirm={confirm}
          onRosterChanged={() => void mutatePlayers()}
        />
      )}

      {confirmDialog}
    </PageMain>
  );
}

function LedgerError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className='text-center space-y-2' role='alert'>
      <p className='text-sm text-destructive'>Couldn&apos;t load the balance. {message}</p>
      <button type='button' onClick={onRetry} className='min-h-11 px-4 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'>
        Retry
      </button>
    </div>
  );
}

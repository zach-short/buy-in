import { formatCents, formatDate, type NightNet, type SharedTab } from '@pb/core';
import { paidLine } from '@/components/settle/net-copy';
import { sharedNightNet } from '@/lib/ledger';

import { portalNetText } from './net-words';

// The history behind the portal's balance, built from the tab the page already fetched — no
// second query. Each night's figures are sharedNightNet (ledger.ts), which is nightNet over
// that session's rows, so the numbers here and the balance above come from one formula.
// A payment with no session belongs to no night; it is listed on its own, or the nights
// would not add up to the balance.

interface PortalNight {
  sessionId: string;
  name: string;
  playedOn: string | null;
  net: NightNet;
}

type SharedPayment = SharedTab['payments'][number];

// Every session any row points at, not just tab.sessions, so a row whose session the RPC
// did not describe still counts somewhere rather than silently leaving the history short.
function sessionIdsWithRows(tab: SharedTab): Set<string> {
  const ids = new Set<string>();
  for (const rows of [tab.orders, tab.buy_ins, tab.cashouts]) rows.forEach((r) => ids.add(r.session_id));
  tab.payments.forEach((p) => p.session_id && ids.add(p.session_id));
  return ids;
}

// played_on is a date, so ISO strings sort correctly; an undescribed session sorts last.
function newestFirst(a: PortalNight, b: PortalNight): number {
  return (b.playedOn ?? '').localeCompare(a.playedOn ?? '');
}

function portalNights(tab: SharedTab): PortalNight[] {
  const sessions = new Map(tab.sessions.map((s) => [s.id, s]));
  return [...sessionIdsWithRows(tab)]
    .map((id) => ({
      sessionId: id,
      name: sessions.get(id)?.name ?? 'A night at the table',
      playedOn: sessions.get(id)?.played_on ?? null,
      net: sharedNightNet(tab, id),
    }))
    .sort(newestFirst);
}

const ROW = 'flex items-baseline justify-between gap-3 text-xs';

function Line({ label, amount }: { label: string; amount: string }) {
  return (
    <div className={ROW}>
      <span className='text-muted-foreground'>{label}</span>
      <span className='tabular-nums'>{amount}</span>
    </div>
  );
}

function NightLines({ net }: { net: NightNet }) {
  const paid = paidLine(net.paidCents, 'player');
  return (
    <div className='space-y-1.5 pt-3'>
      {net.drinksCents > 0 && <Line label='Drinks' amount={`+$${formatCents(net.drinksCents)}`} />}
      {net.buyInsCents > 0 && <Line label='Buy-ins' amount={`+$${formatCents(net.buyInsCents)}`} />}
      {net.cashoutsCents > 0 && <Line label='Cash-outs' amount={`−$${formatCents(net.cashoutsCents)}`} />}
      {net.paidCents !== 0 && <Line label={paid.label} amount={paid.amount} />}
    </div>
  );
}

function NightRow({ night }: { night: PortalNight }) {
  return (
    <details className='border border-border rounded-md px-4 py-3'>
      <summary className='flex items-baseline justify-between gap-3 cursor-pointer list-none'>
        <span className='min-w-0'>
          <span className='block text-sm font-medium truncate'>{night.name}</span>
          {night.playedOn && <span className='block text-xs text-muted-foreground'>{formatDate(night.playedOn)}</span>}
        </span>
        <span className='text-xs tabular-nums shrink-0'>{portalNetText(night.net.netCents)}</span>
      </summary>
      <NightLines net={night.net} />
    </details>
  );
}

function LoosePayments({ payments }: { payments: SharedPayment[] }) {
  return (
    <details className='border border-border rounded-md px-4 py-3'>
      <summary className='flex items-baseline justify-between gap-3 cursor-pointer list-none'>
        <span className='text-sm font-medium'>Payments</span>
        <span className='text-xs text-muted-foreground shrink-0'>{payments.length}</span>
      </summary>
      <div className='space-y-1.5 pt-3'>
        {payments.map((p) => {
          const line = paidLine(p.direction === 'received' ? p.amount_cents : -p.amount_cents, 'player');
          return <Line key={p.id} label={`${line.label} · ${formatDate(p.created_at)}`} amount={line.amount} />;
        })}
      </div>
    </details>
  );
}

export function NightHistory({ tab }: { tab: SharedTab }) {
  const nights = portalNights(tab);
  const loose = tab.payments
    .filter((p) => p.session_id === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!nights.length && !loose.length) return null;

  return (
    <section className='mx-6 mb-8'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>History</p>
      <div className='space-y-2'>
        {loose.length > 0 && <LoosePayments payments={loose} />}
        {nights.map((night) => <NightRow key={night.sessionId} night={night} />)}
      </div>
    </section>
  );
}

'use client';

import { use, useState } from 'react';
import useSWR from 'swr';

import { describeNet, formatCents } from '@pb/core';
import { portalNetText } from '@/components/portal/net-words';
import { NightHistory } from '@/components/portal/night-history';
import { PayPanel } from '@/components/portal/pay-panel';
import { PaymentReportList, ReportPaymentForm } from '@/components/portal/payment-reports';
import { usePaymentReports } from '@/components/portal/use-payment-reports';
import { StatusScreen } from '@/components/shared/status-screen';
import { sharedBalanceCents } from '@/lib/ledger';
import { fetchMenu, fetchSharedTab } from '@/lib/supabase/public';

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  // A portal-scoped link (D15): the whole history, and the token alone decides whose (§9.1
  // #7) — the old route's [playerId] segment is gone, so nothing on this page can trust a URL
  // over the RPC.
  const { data: tab, error } = useSWR(['shared_tab', token, 'portal'], ([, t]) => fetchSharedTab(t, 'portal'));
  // The menu block reads the same get_menu the public /menu does (§9.1 #3), never raw stock.
  const { data: menu = [] } = useSWR(tab ? ['menu', tab.bar.id] : null, ([, barId]) => fetchMenu(barId));
  const reports = usePaymentReports(token);
  // The amount the report form opens with; null is closed.
  const [reportCents, setReportCents] = useState<number | null>(null);

  if (error) {
    return <StatusScreen kind='error' title='Invalid link' message='This link may be outdated. Ask your host for a new link.' />;
  }

  if (!tab) return <StatusScreen kind='loading' />;

  const { player } = tab;
  const balanceCents = sharedBalanceCents(tab);
  const balance = describeNet(balanceCents);
  const available = menu.filter((d) => d.available);
  // The Go-era button paid the player's OWN Venmo handle (bar-api.ts openVenmo); D15 stopped
  // returning it, and the recipient is always the host's (D6). The note is the host's
  // template, plain "Buy-In" by default — never the amount unless the host's template asks
  // for it (owner, 2026-09-27; 0003). PayPanel renders it for the amount actually paid.

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&display=swap');
        .portal-menu-root {
          background: #000;
          padding: 2rem 1.5rem 3rem;
          font-family: 'Cinzel', serif;
        }
        .portal-menu-title {
          color: #c9a84c;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 0.4rem;
        }
        .portal-menu-rule {
          width: 120px;
          border: none;
          border-top: 1px solid #c9a84c55;
          margin: 1rem auto 1.5rem;
        }
        .portal-menu-item {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .portal-menu-dots {
          flex: 1;
          border-bottom: 1px dotted #c9a84c44;
          margin: 0 0.5rem 4px;
        }
        .portal-menu-name, .portal-menu-price {
          color: #c9a84c;
          font-size: 0.8rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          white-space: nowrap;
        }
      `}</style>

      <main className='min-h-dvh max-w-sm mx-auto pb-16'>
        <div className='px-6 py-10'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-1'>Buy-In</p>
          <h1 className='text-xl font-semibold tracking-widest uppercase text-primary'>{player.name}</h1>
        </div>

        <div className='mx-6 border border-border rounded-md p-6 mb-8 text-center'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>Your Balance</p>
          {balance.kind === 'even' ? (
            <p className='text-3xl font-bold text-muted-foreground'>{portalNetText(balanceCents)}</p>
          ) : (
            <>
              <p className={`text-3xl font-bold tabular-nums ${balance.kind === 'owes' ? 'text-destructive' : 'text-green-500'}`}>
                ${formatCents(balance.amountCents)}
              </p>
              <p className='text-xs text-muted-foreground mt-2 tracking-wide'>
                {balance.kind === 'owes' ? 'You owe' : "You're owed"}
              </p>
            </>
          )}
          {balance.kind === 'owes' && (
            <>
              <PayPanel key={balanceCents} bar={tab.bar} balanceCents={balanceCents} onPay={setReportCents} />
              {reportCents === null && (
                <button
                  type='button'
                  onClick={() => setReportCents(balanceCents)}
                  className='mt-4 text-xs tracking-widest uppercase text-muted-foreground underline underline-offset-4 hover:text-foreground'
                >
                  I already sent a payment
                </button>
              )}
            </>
          )}
        </div>

        {reportCents !== null && (
          <ReportPaymentForm key={reportCents} defaultCents={reportCents} api={reports} onClose={() => setReportCents(null)} />
        )}
        {reports.reports && <PaymentReportList reports={reports.reports} />}

        <NightHistory tab={tab} />

        {available.length > 0 && (
          <div className='portal-menu-root mx-6 rounded-md'>
            <p className='portal-menu-title'>Tonight&apos;s Menu</p>
            <hr className='portal-menu-rule' />
            {available.map((drink) => (
              <div key={drink.id} className='portal-menu-item'>
                <span className='portal-menu-name'>{drink.name}</span>
                <span className='portal-menu-dots' />
                <span className='portal-menu-price'>${formatCents(drink.price_cents)}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

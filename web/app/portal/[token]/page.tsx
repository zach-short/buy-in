'use client';

import { use } from 'react';
import useSWR from 'swr';

import { formatCents, isSettled, renderVenmoNote, venmoUrls } from '@pb/core';
import { sharedBalanceCents } from '@/lib/ledger';
import { fetchMenu, fetchSharedTab } from '@/lib/supabase/public';
import { openVenmo } from '@/lib/venmo';

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  // A portal-scoped link (D15): the whole history, and the token alone decides whose (§9.1
  // #7) — the old route's [playerId] segment is gone, so nothing on this page can trust a URL
  // over the RPC.
  const { data: tab, error } = useSWR(['shared_tab', token, 'portal'], ([, t]) => fetchSharedTab(t, 'portal'));
  // The menu block reads the same get_menu the public /menu does (§9.1 #3), never raw stock.
  const { data: menu = [] } = useSWR(tab ? ['menu', tab.bar.id] : null, ([, barId]) => fetchMenu(barId));

  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center px-6'>
        <div className='text-center space-y-2'>
          <p className='text-sm font-medium text-destructive'>Invalid link</p>
          <p className='text-xs text-muted-foreground'>This link may be outdated. Ask Zach for a new one.</p>
        </div>
      </div>
    );
  }

  if (!tab) {
    return (
      <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
        Loading…
      </div>
    );
  }

  const { player } = tab;
  const balanceCents = sharedBalanceCents(tab);
  const available = menu.filter((d) => d.available);
  // The Go-era button paid the player's OWN Venmo handle (bar-api.ts openVenmo); D15 stopped
  // returning it, and the recipient is always the host's (D6). The note for a whole balance
  // is the host's template, plain "Buy-In" by default — never the amount unless the host's
  // template asks for it (owner, 2026-09-27; 0003).
  const handle = tab.bar.venmo_handle;
  const note = renderVenmoNote(tab.bar.venmo_note_template, { amountCents: balanceCents });

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

      <main className='min-h-screen max-w-sm mx-auto pb-16'>
        <div className='px-6 py-10'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-1'>Buy-In</p>
          <h1 className='text-xl font-semibold tracking-widest uppercase text-primary'>{player.name}</h1>
        </div>

        <div className='mx-6 border border-border rounded-md p-6 mb-8 text-center'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>Your Balance</p>
          {isSettled(balanceCents) ? (
            <p className='text-3xl font-bold text-muted-foreground'>All settled up</p>
          ) : balanceCents > 0 ? (
            <>
              <p className='text-3xl font-bold text-destructive'>${formatCents(balanceCents)}</p>
              <p className='text-xs text-muted-foreground mt-2 tracking-wide'>outstanding</p>
              {handle && (
                <button
                  onClick={() => openVenmo(venmoUrls(handle, balanceCents, note))}
                  className='mt-4 w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-bold text-white'
                  style={{ background: '#3D95CE' }}
                >
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='white'>
                    <path d='M19.07 3C19.82 4.27 20.16 5.58 20.16 7.22C20.16 12.23 15.68 18.72 12.05 22H4.27L1 4.36L8.19 3.67L9.84 15.05C11.42 12.36 13.38 8.19 13.38 5.42C13.38 3.97 13.1 2.97 12.68 2.14L19.07 3Z' />
                  </svg>
                  Pay ${formatCents(balanceCents)} on Venmo
                </button>
              )}
            </>
          ) : (
            <>
              <p className='text-3xl font-bold text-green-500'>${formatCents(Math.abs(balanceCents))}</p>
              <p className='text-xs text-muted-foreground mt-2 tracking-wide'>in your favour</p>
            </>
          )}
        </div>

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

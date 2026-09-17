'use client';

import { use, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher, computeBalance, canMake, openVenmo, Order, BuyIn, Cashout, Payment, DrinkRecipe, InventoryItem, Player } from '@/lib/bar-api';

export default function PortalPage({
  params,
}: {
  params: Promise<{ playerId: string; token: string }>;
}) {
  const { playerId, token } = use(params);

  const { data: auth, error: authError } = useSWR<{ valid: boolean; player: Player }>(
    `/api/portal/${playerId}/validate?token=${token}`,
    fetcher,
  );

  useEffect(() => {
    if (auth?.valid) localStorage.setItem(`portal_${playerId}`, token);
  }, [auth, playerId, token]);

  const enabled = auth?.valid ?? false;
  const { data: orders = [] }    = useSWR<Order[]>(enabled ? '/api/orders' : null, fetcher);
  const { data: buyIns = [] }    = useSWR<BuyIn[]>(enabled ? '/api/buyins' : null, fetcher);
  const { data: cashouts = [] }  = useSWR<Cashout[]>(enabled ? '/api/cashouts' : null, fetcher);
  const { data: payments = [] }  = useSWR<Payment[]>(enabled ? `/api/payments?playerId=${playerId}` : null, fetcher);
  const { data: drinks = [] }    = useSWR<DrinkRecipe[]>(enabled ? '/api/drinks' : null, fetcher);
  const { data: inventory = [] } = useSWR<InventoryItem[]>(enabled ? '/api/inventory' : null, fetcher);

  if (authError) {
    return (
      <div className='min-h-screen flex items-center justify-center px-6'>
        <div className='text-center space-y-2'>
          <p className='text-sm font-medium text-destructive'>Invalid link</p>
          <p className='text-xs text-muted-foreground'>This link may be outdated. Ask Zach for a new one.</p>
        </div>
      </div>
    );
  }

  if (!auth) {
    return (
      <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
        Loading…
      </div>
    );
  }

  const player = auth.player;
  const balance = computeBalance(playerId, orders, buyIns, cashouts, payments);
  const available = drinks.filter((d) => canMake(d, inventory));

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
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-1'>Poker Bar</p>
          <h1 className='text-xl font-semibold tracking-widest uppercase text-primary'>{player.name}</h1>
        </div>

        <div className='mx-6 border border-border rounded-md p-6 mb-8 text-center'>
          <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>Your Balance</p>
          {Math.abs(balance) < 0.01 ? (
            <p className='text-3xl font-bold text-muted-foreground'>All settled up</p>
          ) : balance > 0 ? (
            <>
              <p className='text-3xl font-bold text-destructive'>${balance.toFixed(2)}</p>
              <p className='text-xs text-muted-foreground mt-2 tracking-wide'>outstanding</p>
              {player.venmo && (
                <button
                  onClick={() => openVenmo(player.venmo!, balance)}
                  className='mt-4 w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-bold text-white'
                  style={{ background: '#3D95CE' }}
                >
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='white'>
                    <path d='M19.07 3C19.82 4.27 20.16 5.58 20.16 7.22C20.16 12.23 15.68 18.72 12.05 22H4.27L1 4.36L8.19 3.67L9.84 15.05C11.42 12.36 13.38 8.19 13.38 5.42C13.38 3.97 13.1 2.97 12.68 2.14L19.07 3Z' />
                  </svg>
                  Pay ${balance.toFixed(2)} on Venmo
                </button>
              )}
            </>
          ) : (
            <>
              <p className='text-3xl font-bold text-green-500'>${Math.abs(balance).toFixed(2)}</p>
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
                <span className='portal-menu-price'>${drink.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

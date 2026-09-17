'use client';

import useSWR from 'swr';
import { fetcher, canMake, DrinkRecipe, InventoryItem } from '@/lib/bar-api';

export default function MenuPage() {
  const { data: drinks = [] } = useSWR<DrinkRecipe[]>('/api/drinks', fetcher);
  const { data: inventory = [] } = useSWR<InventoryItem[]>('/api/inventory', fetcher);

  const available = drinks.filter((d) => canMake(d, inventory));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&display=swap');

        .menu-root {
          min-height: 100vh;
          background: #000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem;
          font-family: 'Cinzel', serif;
        }

        .menu-title {
          color: #c9a84c;
          font-size: 2rem;
          font-weight: 600;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          margin-bottom: 0.5rem;
          text-align: center;
        }

        .menu-rule {
          width: 180px;
          border: none;
          border-top: 1px solid #c9a84c55;
          margin: 1.5rem auto 2.5rem;
        }

        .menu-list {
          width: 100%;
          max-width: 420px;
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 1.4rem;
        }

        .menu-item {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 1rem;
        }

        .menu-dots {
          flex: 1;
          border-bottom: 1px dotted #c9a84c44;
          margin: 0 0.5rem 4px;
        }

        .menu-name {
          color: #c9a84c;
          font-size: 0.95rem;
          font-weight: 400;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .menu-price {
          color: #c9a84c;
          font-size: 0.95rem;
          font-weight: 400;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        .menu-footer {
          margin-top: 3rem;
          color: #c9a84c44;
          font-size: 0.6rem;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          text-align: center;
        }

      `}</style>

      <div className='menu-root'>
        <h1 className='menu-title'>Menu</h1>
        <hr className='menu-rule' />

        <ul className='menu-list'>
          {available.map((drink) => (
            <li key={drink.id} className='menu-item'>
              <span className='menu-name'>{drink.name}</span>
              <span className='menu-dots' />
              <span className='menu-price'>{drink.price}</span>
            </li>
          ))}
        </ul>

        {available.length === 0 && (
          <p style={{ color: '#c9a84c55', fontFamily: 'Cinzel, serif', fontSize: '0.8rem', letterSpacing: '0.2em' }}>
            NO DRINKS AVAILABLE
          </p>
        )}

        <p className='menu-footer'>Tonight&apos;s Selection</p>
      </div>

    </>
  );
}

import { Cinzel } from 'next/font/google';

import { formatCents, type MenuItem } from '@pb/core';

// Self-hosted at build time by next/font, in place of a runtime Google Fonts @import: no request
// to Google from a guest's phone, and no flash of the fallback serif while it loads.
const cinzel = Cinzel({ weight: ['400', '600'], subsets: ['latin'], display: 'swap', variable: '--font-menu' });

// The /menu board, shared by /menu/[barId] and the bare /menu a logged-out visitor lands on.
// Markup and styles are the pre-migration page's, unchanged (DESIGN.md §8.2); only the rows'
// source moved, to get_menu (D14), and only available drinks are drawn, as canMake decided
// before — now decided server-side (BD-3).
export function MenuBoard({ items }: { items: readonly MenuItem[] }) {
  const available = items.filter((d) => d.available);

  return (
    <>
      <style>{`
        .menu-root {
          min-height: 100vh;
          background: #000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem;
          font-family: var(--font-menu), serif;
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

      <div className={`menu-root ${cinzel.variable}`}>
        <h1 className='menu-title'>Menu</h1>
        <hr className='menu-rule' />

        <ul className='menu-list'>
          {available.map((drink) => (
            <li key={drink.id} className='menu-item'>
              <span className='menu-name'>{drink.name}</span>
              <span className='menu-dots' />
              <span className='menu-price'>{formatCents(drink.price_cents)}</span>
            </li>
          ))}
        </ul>

        {available.length === 0 && (
          <p style={{ color: '#c9a84c55', fontSize: '0.8rem', letterSpacing: '0.2em' }}>
            NO DRINKS AVAILABLE
          </p>
        )}

        <p className='menu-footer'>Tonight&apos;s Selection</p>
      </div>
    </>
  );
}

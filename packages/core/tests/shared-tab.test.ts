import { describe, expect, it } from 'vitest';

import { parseMenu, parseSharedTab, requireScope } from '../src/shared-tab';

// The shape get_shared_tab returns (supabase/migrations/0001_init.sql, D15), as JSON.
function tab(scope: 'portal' | 'session') {
  return {
    scope,
    bar: { id: 'b1', name: 'Buy-In', venmo_handle: '@host', cashapp_handle: null },
    player: { id: 'p1', name: 'Dom' },
    sessions: [
      { id: 's1', name: 'Friday', played_on: '2026-09-26T23:00:00+00:00', status: 'closed', settle_mode: 'banked' },
    ],
    orders: [
      { id: 'o1', session_id: 's1', drink_name: 'Beer', price_cents: 500, paid: false, created_at: '2026-09-26T23:10:00+00:00' },
    ],
    buy_ins: [{ id: 'bi1', session_id: 's1', amount_cents: 2000, created_at: '2026-09-26T23:00:00+00:00' }],
    cashouts: [],
    payments: [{ id: 'pay1', session_id: null, amount_cents: 1000, direction: 'received', created_at: '2026-09-27T01:00:00+00:00' }],
  };
}

describe('parseSharedTab', () => {
  it('accepts the RPC shape', () => {
    expect(parseSharedTab(tab('portal')).player.name).toBe('Dom');
  });

  it('strips a column SQL adds that the contract does not name', () => {
    const raw = tab('session');
    const leaky = { ...raw, player: { ...raw.player, venmo: '@player-own' } };
    expect(parseSharedTab(leaky).player).toEqual({ id: 'p1', name: 'Dom' });
  });

  it('rejects a float amount, since money is integer cents', () => {
    const raw = tab('session');
    expect(() => parseSharedTab({ ...raw, buy_ins: [{ ...raw.buy_ins[0], amount_cents: 20.5 }] })).toThrow();
  });

  it('rejects an error body in place of a tab', () => {
    expect(() => parseSharedTab({ message: 'invalid or expired link' })).toThrow();
  });
});

describe('requireScope', () => {
  it('passes the matching scope through', () => {
    expect(requireScope(parseSharedTab(tab('session')), 'session').scope).toBe('session');
  });

  it('refuses a portal link on the receipt page and a receipt link on the portal', () => {
    expect(() => requireScope(parseSharedTab(tab('portal')), 'session')).toThrow();
    expect(() => requireScope(parseSharedTab(tab('session')), 'portal')).toThrow();
  });
});

describe('parseMenu', () => {
  it('accepts get_menu rows and an empty menu', () => {
    expect(parseMenu([{ id: 'd1', name: 'Beer', price_cents: 500, available: true }])).toHaveLength(1);
    expect(parseMenu([])).toEqual([]);
  });

  it('refuses stock levels leaking into the menu shape by dropping them', () => {
    const [item] = parseMenu([{ id: 'd1', name: 'Beer', price_cents: 500, available: false, qty_on_hand: 3 }]);
    expect(item).toEqual({ id: 'd1', name: 'Beer', price_cents: 500, available: false });
  });
});

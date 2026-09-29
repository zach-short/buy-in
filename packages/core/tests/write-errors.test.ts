import { describe, expect, it } from 'vitest';

import { writeErrorMessage } from '../src/write-errors';

// Each input is a message Postgres produced on the phase 6 harness (PG17, 0001 + 0002,
// 2026-09-26); each expected output is the Go API's message for the same failure, or D19's.
describe('writeErrorMessage', () => {
  it("renders create_order's stock failure exactly as the Go API's %.2f format did", () => {
    expect(writeErrorMessage({ message: 'insufficient stock for Lime (have 0.500 oz, need 1.000)', code: '23514' }))
      .toBe('Insufficient stock for Lime (have 0.50 oz, need 1.00)');
  });

  it('keeps spaces in the item name and the unit', () => {
    expect(writeErrorMessage({ message: 'insufficient stock for Simple Syrup (have 0.000 fl oz, need 0.750)' }))
      .toBe('Insufficient stock for Simple Syrup (have 0.00 fl oz, need 0.75)');
  });

  it('maps a duplicate player name to the Go create message', () => {
    const message = 'duplicate key value violates unique constraint "players_bar_name_uniq"';
    expect(writeErrorMessage({ message, code: '23505' })).toBe('Player with this name already exists');
  });

  it('leaves other unique violations alone', () => {
    const message = 'duplicate key value violates unique constraint "cashouts_session_player_uniq"';
    expect(writeErrorMessage({ message, code: '23505' })).toBe(message);
  });

  it("gives D19's refusal its chosen copy", () => {
    expect(writeErrorMessage({ message: 'session has orders', code: '23001' }))
      .toBe("Undo this session's drinks before deleting it.");
  });

  it('capitalises the functions\' not-found raises as Go did', () => {
    expect(writeErrorMessage({ message: 'order not found', code: 'P0002' })).toBe('Order not found');
    expect(writeErrorMessage({ message: 'drink not found' })).toBe('Drink not found');
    expect(writeErrorMessage({ message: 'session not found' })).toBe('Session not found');
  });

  it('passes an unknown message through unchanged', () => {
    expect(writeErrorMessage({ message: 'new row violates row-level security policy for table "buy_ins"' }))
      .toBe('new row violates row-level security policy for table "buy_ins"');
  });

  it('explains a delete_session refused by tagged payments', () => {
    const message = 'update or delete on table "sessions" violates foreign key constraint "payments_session_id_bar_id_fkey" on table "payments"';
    expect(writeErrorMessage({ message, code: '23503' })).toBe("Remove this night's payments before deleting it.");
  });

  it('leaves other foreign-key violations alone', () => {
    const message = 'update or delete on table "sessions" violates foreign key constraint "orders_session_id_bar_id_fkey" on table "orders"';
    expect(writeErrorMessage({ message, code: '23503' })).toBe(message);
  });

  it('tells the host to restore an archived drink', () => {
    expect(writeErrorMessage({ message: 'drink is archived', code: '23514' }))
      .toBe('That drink is archived — restore it on the Drinks page to pour it.');
  });

  it('keeps "insufficient stock" detectable after mapping', () => {
    const mapped = writeErrorMessage({ message: 'insufficient stock for Lime (have 0.500 oz, need 1.000)' });
    expect(/insufficient stock/i.test(mapped)).toBe(true);
  });

  it('maps the create_order guards and link raises to sentences', () => {
    expect(writeErrorMessage({ message: 'session is closed' })).toBe('This session is closed.');
    expect(writeErrorMessage({ message: 'player is not in this session' })).toBe('That player is not in this session.');
    expect(writeErrorMessage({ message: 'invalid or expired link' })).toBe('This link is invalid or has expired.');
    expect(writeErrorMessage({ message: 'responding requires an authenticated user' })).toBe('Sign in to respond to this invite.');
    expect(writeErrorMessage({ message: 'this report was already decided' })).toBe('This report was already decided.');
  });

  it("explains merge_players' rollback guards", () => {
    expect(writeErrorMessage({ message: 'merge would change the combined balance (12 before, 13 after)' }))
      .toBe('The merge was undone: it would have changed the combined balance.');
    expect(writeErrorMessage({ message: 'player row changed under lock' }))
      .toBe('The merge was undone: a player changed while it ran. Try again.');
  });
});

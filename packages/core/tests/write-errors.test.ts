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
});

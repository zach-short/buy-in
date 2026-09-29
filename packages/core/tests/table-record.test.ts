import { describe, expect, it } from 'vitest';

import { tableRecords } from '../src/table-record';

const colin = { barId: 'b1', barName: "Colin's" };
const dana = { barId: 'b2', barName: "Dana's" };
const aria = { barId: 'b3', barName: "Aria's" };

describe('tableRecords', () => {
  it('sums games and net per table, won-positive', () => {
    const played = [
      { bar_id: 'b1', played_on: '2026-09-01T20:00:00Z', net_cents: 2000 },
      { bar_id: 'b1', played_on: '2026-09-08T20:00:00Z', net_cents: -500 },
      { bar_id: 'b2', played_on: '2026-09-02T20:00:00Z', net_cents: -1000 },
    ];
    const [first, second] = tableRecords([colin, dana], played);
    expect(first).toEqual({ barId: 'b1', barName: "Colin's", games: 2, netCents: 1500, lastPlayedOn: '2026-09-08T20:00:00Z' });
    expect(second).toEqual({ barId: 'b2', barName: "Dana's", games: 1, netCents: -1000, lastPlayedOn: '2026-09-02T20:00:00Z' });
  });

  it('lists a table joined but never played at, after the played ones, by name', () => {
    const played = [{ bar_id: 'b2', played_on: '2026-09-02T20:00:00Z', net_cents: 0 }];
    const records = tableRecords([colin, dana, aria], played);
    expect(records.map((r) => r.barId)).toEqual(['b2', 'b3', 'b1']);
    expect(records[1]).toEqual({ barId: 'b3', barName: "Aria's", games: 0, netCents: 0, lastPlayedOn: null });
  });

  it('never adds a card for a session at a table the account no longer sits at', () => {
    const played = [{ bar_id: 'gone', played_on: '2026-09-02T20:00:00Z', net_cents: 900 }];
    expect(tableRecords([colin], played)).toEqual([
      { barId: 'b1', barName: "Colin's", games: 0, netCents: 0, lastPlayedOn: null },
    ]);
  });

  it('is empty with no seats', () => {
    expect(tableRecords([], [])).toEqual([]);
  });
});

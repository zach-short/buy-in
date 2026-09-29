import { describe, expect, it } from 'vitest';

import { tableRecords, withNextGames, type TableRecord } from '../src/table-record';

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

describe('withNextGames', () => {
  const played: TableRecord = { barId: 'b1', barName: "Colin's", games: 2, netCents: 1500, lastPlayedOn: '2026-09-08T20:00:00Z' };
  const fresh: TableRecord = { barId: 'b2', barName: "Dana's", games: 0, netCents: 0, lastPlayedOn: null };
  const friday = { bar_id: 'b1', game_id: 'g1', name: 'Friday Game', scheduled_at: '2026-10-02T00:00:00Z', my_status: 'yes' };

  it('puts each table\'s next game on its record, and the answer the member gave', () => {
    const [first] = withNextGames([played], [friday]);
    expect(first).toEqual({ ...played, nextGame: { gameId: 'g1', name: 'Friday Game', scheduledAt: '2026-10-02T00:00:00Z', myStatus: 'yes' } });
  });

  it('leaves a table with no game scheduled at null, and keeps the records\' order', () => {
    const records = withNextGames([played, fresh], [{ ...friday, bar_id: 'b2', game_id: 'g2' }]);
    expect(records.map((r) => [r.barId, r.nextGame?.gameId ?? null])).toEqual([['b1', null], ['b2', 'g2']]);
  });

  it('reads no answer yet, or one it does not know, as null', () => {
    const none = withNextGames([played], [{ ...friday, my_status: null }]);
    const odd = withNextGames([played], [{ ...friday, my_status: 'perhaps' }]);
    expect(none[0].nextGame?.myStatus).toBeNull();
    expect(odd[0].nextGame?.myStatus).toBeNull();
  });

  it('never shows a game at a table the member has no card for', () => {
    expect(withNextGames([played], [{ ...friday, bar_id: 'gone' }])).toEqual([{ ...played, nextGame: null }]);
  });
});

import { describe, expect, it } from 'vitest';

import {
  codeStatus, hasLapsed, INVITE_LIFETIME_LABELS, INVITE_LIFETIMES, isInviteToken,
  isValidCustomCode, neverExpires, normalizeInviteCode,
} from '../src/invite-code';

const NOW = new Date('2026-09-29T12:00:00Z');
const LATER = '2026-09-30T11:00:00Z';
const EARLIER = '2026-09-29T11:00:00Z';

describe('normalizeInviteCode and isValidCustomCode', () => {
  it('trims and upper-cases, as the database stores it', () => {
    expect(normalizeInviteCode('  aces ')).toBe('ACES');
  });

  it('takes 4 to 8 letters or digits', () => {
    expect(isValidCustomCode('0420')).toBe(true);
    expect(isValidCustomCode('friday99')).toBe(true);
    expect(isValidCustomCode('abc')).toBe(false);
    expect(isValidCustomCode('abcdefghi')).toBe(false);
    expect(isValidCustomCode('ab-cd')).toBe(false);
  });
});

describe('isInviteToken', () => {
  it('knows a pasted token from a code', () => {
    expect(isInviteToken('f119292ea4994fbf27d6568a4e3d523f0b852bde944144fe')).toBe(true);
    expect(isInviteToken(' f119292ea4994fbf27d6568a4e3d523f0b852bde944144fe ')).toBe(true);
    expect(isInviteToken('2734')).toBe(false);
    expect(isInviteToken('FRIDAY')).toBe(false);
  });
});

describe('codeStatus', () => {
  it('is none for a link-only invite', () => {
    expect(codeStatus({ kind: 'link', code: null, code_expires_at: null }, NOW)).toBe('none');
  });

  it('is live before the code expires', () => {
    expect(codeStatus({ kind: 'both', code: '2734', code_expires_at: LATER }, NOW)).toBe('live');
  });

  it('is lapsed once past its time, even before the database nulls it', () => {
    expect(codeStatus({ kind: 'both', code: '2734', code_expires_at: EARLIER }, NOW)).toBe('lapsed');
    expect(codeStatus({ kind: 'code', code: null, code_expires_at: EARLIER }, NOW)).toBe('lapsed');
  });
});

describe('never-expiring invites (0030, infinity)', () => {
  it('reads infinity as never, and never as not lapsed', () => {
    expect(neverExpires('infinity')).toBe(true);
    expect(neverExpires(LATER)).toBe(false);
    expect(hasLapsed('infinity', NOW)).toBe(false);
  });

  it('still reads real timestamps', () => {
    expect(hasLapsed(EARLIER, NOW)).toBe(true);
    expect(hasLapsed(LATER, NOW)).toBe(false);
  });

  it('keeps a never-expiring code live, where new Date would have read it as lapsed', () => {
    expect(new Date('infinity') > NOW).toBe(false);
    expect(codeStatus({ kind: 'code', code: 'ACES', code_expires_at: 'infinity' }, NOW)).toBe('live');
  });

  it('labels every lifetime 0030 accepts, in order', () => {
    expect(INVITE_LIFETIMES).toEqual(['1h', '24h', '7d', '30d', 'never']);
    expect(INVITE_LIFETIMES.map((l) => INVITE_LIFETIME_LABELS[l]))
      .toEqual(['1 hour', '24 hours', '7 days', '30 days', 'Never']);
  });
});

import { describe, expect, it } from 'vitest';

import {
  codeStatus, inviteShareText, isInviteToken, isValidCustomCode, normalizeInviteCode,
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

describe('inviteShareText', () => {
  const link = 'https://buyin.example/join/abc';
  const joinPage = 'https://buyin.example/join';

  it('sends a link-only invite bare', () => {
    expect(inviteShareText({ kind: 'link', link, code: null, joinPage })).toBe(link);
  });

  it('names both ways in for a link with a code', () => {
    expect(inviteShareText({ kind: 'both', link, code: '2734', joinPage }))
      .toBe(`Join my poker table on Buy-In: ${link} — or enter code 2734 at ${joinPage}`);
  });

  it('leaves the link out of a code-only invite', () => {
    const text = inviteShareText({ kind: 'code', link, code: 'ACES', joinPage });
    expect(text).toBe(`Join my poker table on Buy-In: enter code ACES at ${joinPage}`);
    expect(text).not.toContain(link);
  });

  it('falls back to the link when a code has lapsed', () => {
    expect(inviteShareText({ kind: 'both', link, code: null, joinPage })).toBe(link);
  });
});

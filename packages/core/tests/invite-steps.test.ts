import { describe, expect, it } from 'vitest';

import { inviteSteps } from '../src/invite-steps';

describe('inviteSteps', () => {
  it('asks a link-only invite for no code length', () => {
    expect(inviteSteps('link', false)).toEqual(['kind', 'lifetime', 'review']);
  });

  it('asks a code-only invite for its length, then one lifetime', () => {
    expect(inviteSteps('code', false)).toEqual(['kind', 'length', 'lifetime', 'review']);
  });

  it('asks a link + code invite for one lifetime unless the host splits them', () => {
    expect(inviteSteps('both', false)).toEqual(['kind', 'length', 'lifetime', 'review']);
    expect(inviteSteps('both', true)).toEqual(['kind', 'length', 'lifetime', 'code-lifetime', 'review']);
  });

  it('ignores a split on an invite with only one lifetime to set', () => {
    expect(inviteSteps('link', true)).toEqual(['kind', 'lifetime', 'review']);
    expect(inviteSteps('code', true)).toEqual(['kind', 'length', 'lifetime', 'review']);
  });

  it('always starts with the kind and ends with the review', () => {
    for (const kind of ['link', 'code', 'both'] as const) {
      const steps = inviteSteps(kind, true);
      expect(steps[0]).toBe('kind');
      expect(steps.at(-1)).toBe('review');
    }
  });
});

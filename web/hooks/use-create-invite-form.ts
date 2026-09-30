'use client';

import { useState } from 'react';

import type { GeneratedCodeLength, InviteKind, InviteLifetime } from '@pb/core';
import { INVITE_DEFAULT_LIFETIME } from '@/lib/config';
import type { NewInvite } from '@/lib/supabase/standing-invites';

interface Lifetimes {
  same: boolean;
  link: InviteLifetime;
  code: InviteLifetime;
}

/**
 * The /invites create form's choices (SCOPE A7, A11). "Same for both" starts on; while it is on,
 * or the invite has only one half, one pick sets both lifetimes, so turning it off starts the two
 * pickers where the one left them.
 */
export function useCreateInviteForm() {
  const [kind, setKind] = useState<InviteKind>('both');
  const [codeLength, setCodeLength] = useState<GeneratedCodeLength>(4);
  const [lifetimes, setLifetimes] = useState<Lifetimes>({
    same: true, link: INVITE_DEFAULT_LIFETIME, code: INVITE_DEFAULT_LIFETIME,
  });
  const split = kind === 'both' && !lifetimes.same;

  return {
    kind, setKind, codeLength, setCodeLength, split,
    same: lifetimes.same,
    link: lifetimes.link,
    code: lifetimes.code,
    setSame: (same: boolean) => setLifetimes((l) => ({ same, link: l.link, code: same ? l.link : l.code })),
    setBoth: (value: InviteLifetime) => setLifetimes((l) => ({ ...l, link: value, code: value })),
    setLink: (link: InviteLifetime) => setLifetimes((l) => ({ ...l, link })),
    setCode: (code: InviteLifetime) => setLifetimes((l) => ({ ...l, code })),
    invite: (): NewInvite => ({ kind, codeLength, linkLifetime: lifetimes.link, codeLifetime: lifetimes.code }),
  };
}

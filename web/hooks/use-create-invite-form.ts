'use client';

import { useState } from 'react';

import { inviteSteps, type GeneratedCodeLength, type InviteKind, type InviteLifetime, type InviteStep } from '@pb/core';
import { INVITE_DEFAULT_LIFETIME } from '@/lib/config';
import type { NewInvite } from '@/lib/supabase/standing-invites';

interface Choices {
  kind: InviteKind;
  codeLength: GeneratedCodeLength;
  link: InviteLifetime;
  code: InviteLifetime;
  /** The host asked for the code to last a different time from the link (SCOPE A11). */
  split: boolean;
}

const FRESH: Choices = {
  kind: 'both',
  codeLength: 4,
  link: INVITE_DEFAULT_LIFETIME,
  code: INVITE_DEFAULT_LIFETIME,
  split: false,
};

/**
 * The /invites create flow: one question at a time (the owner found the single form cumbersome
 * for a first timer, 2026-09-30). Picking an answer moves on. Until the last screen nothing is
 * created, so backing out or closing costs nothing. Which screens appear is core's `inviteSteps`.
 */
export function useCreateInviteForm() {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const [choices, setChoices] = useState<Choices>(FRESH);
  const steps = inviteSteps(choices.kind, choices.split);
  const index = Math.min(at, steps.length - 1);
  const step: InviteStep = steps[index];

  function pick(change: Partial<Choices>) {
    setChoices((c) => ({ ...c, ...change }));
    setAt(index + 1);
  }

  return {
    open, step, index, total: steps.length, choices,
    start: () => { setChoices(FRESH); setAt(0); setOpen(true); },
    close: () => setOpen(false),
    back: () => setAt(Math.max(index - 1, 0)),
    chooseKind: (kind: InviteKind) => pick({ kind, split: kind === 'both' ? choices.split : false }),
    chooseLength: (codeLength: GeneratedCodeLength) => pick({ codeLength }),
    // One pick sets both halves until the host splits them, so a first timer answers this once.
    chooseLifetime: (link: InviteLifetime) => pick(choices.split ? { link } : { link, code: link }),
    chooseCodeLifetime: (code: InviteLifetime) => pick({ code }),
    splitLifetimes: () => setChoices((c) => ({ ...c, split: true })),
    invite: (): NewInvite => ({
      kind: choices.kind, codeLength: choices.codeLength, linkLifetime: choices.link, codeLifetime: choices.code,
    }),
  };
}

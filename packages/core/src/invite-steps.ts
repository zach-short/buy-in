import { hasCode, type InviteKind } from './invite-code';

/** One screen of the create-invite flow. Each asks one question, except `review`, which asks none. */
export type InviteStep = 'kind' | 'length' | 'lifetime' | 'code-lifetime' | 'review';

/**
 * The screens for an invite, in order. Only the questions that matter appear: a link has no code,
 * so no length; the code's own lifetime is asked only when the host asked to split it from the
 * link's (only a link + code invite has two lifetimes to split). `kind` is always first, so a host
 * stepping back to change it never lands on a screen the new answer removed.
 */
export function inviteSteps(kind: InviteKind, splitLifetimes: boolean): InviteStep[] {
  const steps: InviteStep[] = ['kind'];
  if (hasCode(kind)) steps.push('length');
  steps.push('lifetime');
  if (kind === 'both' && splitLifetimes) steps.push('code-lifetime');
  steps.push('review');
  return steps;
}

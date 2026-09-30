import { ArrowLeft, Link2, Plus } from 'lucide-react';

import {
  GENERATED_CODE_LENGTHS, INVITE_LIFETIME_LABELS, INVITE_LIFETIMES, hasCode,
  type InviteKind, type InviteLifetime, type InviteStep,
} from '@pb/core';
import { OptionList } from '@/components/invites/option-list';
import { Button } from '@/components/ui/button';
import { useCreateInviteForm } from '@/hooks/use-create-invite-form';
import type { NewInvite } from '@/lib/supabase/standing-invites';

// Copy is provisional, in the plain register (R7): the owner picks the words for every string here.
const KINDS = [
  { value: 'link', label: 'A link', hint: 'They tap it to join. Good for texting or a group chat.' },
  { value: 'code', label: 'A code', hint: 'They type a short code. Good for saying out loud.' },
  { value: 'both', label: 'A link and a code', hint: 'Either one gets them in.' },
] as const satisfies readonly { value: InviteKind; label: string; hint: string }[];

const LENGTHS = GENERATED_CODE_LENGTHS.map((n) => ({ value: n, label: `${n} digits` }));
const LIFETIMES = INVITE_LIFETIMES.map((value) => ({ value, label: INVITE_LIFETIME_LABELS[value] }));

const QUESTION = 'text-base font-medium mb-3';
const SMALL = 'text-xs tracking-widest uppercase';

function kindLine(invite: NewInvite): string {
  if (invite.kind === 'link') return 'A link';
  const digits = `${invite.codeLength}-digit code`;
  return invite.kind === 'code' ? `A ${digits}` : `A link and a ${digits}`;
}

function lifetimeText(lifetime: InviteLifetime): string {
  return lifetime === 'never' ? 'never expires' : `works for ${INVITE_LIFETIME_LABELS[lifetime].toLowerCase()}`;
}

function lifetimeLine(invite: NewInvite): string {
  if (invite.kind !== 'both' || invite.linkLifetime === invite.codeLifetime) return `It ${lifetimeText(invite.linkLifetime)}.`;
  return `The link ${lifetimeText(invite.linkLifetime)}. The code ${lifetimeText(invite.codeLifetime)}.`;
}

function lifetimeQuestion(kind: InviteKind, split: boolean): string {
  if (kind === 'code') return 'How long should the code work?';
  return kind === 'link' || split ? 'How long should the link work?' : 'How long should it work?';
}

type Form = ReturnType<typeof useCreateInviteForm>;

interface StepProps {
  form: Form;
  creating: boolean;
  onCreate: () => void;
}

function StepBody({ step, form, creating, onCreate }: StepProps & { step: InviteStep }) {
  const { choices } = form;
  switch (step) {
    case 'kind':
      return (
        <>
          <p className={QUESTION}>How should people join?</p>
          <OptionList label='How people join' options={KINDS} value={choices.kind} onPick={form.chooseKind} />
        </>
      );
    case 'length':
      return (
        <>
          <p className={QUESTION}>How long should the code be?</p>
          <OptionList label='Code length' options={LENGTHS} value={choices.codeLength} onPick={form.chooseLength} />
        </>
      );
    case 'lifetime':
      return (
        <>
          <p className={QUESTION}>{lifetimeQuestion(choices.kind, choices.split)}</p>
          <OptionList label='How long it works' options={LIFETIMES} value={choices.link} onPick={form.chooseLifetime} />
          {choices.kind === 'both' && !choices.split && (
            <button type='button' onClick={form.splitLifetimes} className='mt-3 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground'>
              Give the code a different time
            </button>
          )}
        </>
      );
    case 'code-lifetime':
      return (
        <>
          <p className={QUESTION}>How long should the code work?</p>
          <OptionList label='How long the code works' options={LIFETIMES} value={choices.code} onPick={form.chooseCodeLifetime} />
        </>
      );
    case 'review':
      return <Review {...{ form, creating, onCreate }} />;
  }
}

function Review({ form, creating, onCreate }: StepProps) {
  const invite = form.invite();
  return (
    <>
      <p className={QUESTION}>Ready to make it?</p>
      <div className='rounded-md border border-border px-4 py-3 mb-4 space-y-1'>
        <p className='text-sm font-medium'>{kindLine(invite)}</p>
        <p className='text-xs text-muted-foreground'>{lifetimeLine(invite)}</p>
        {hasCode(invite.kind) && <p className='text-xs text-muted-foreground'>We pick the code. You can change it after.</p>}
      </div>
      <Button className={`w-full h-11 ${SMALL}`} onClick={onCreate} disabled={creating}>
        <Link2 aria-hidden='true' />
        {creating ? 'Creating…' : 'Create invite'}
      </Button>
    </>
  );
}

interface CreateInviteFormProps {
  disabled: boolean;
  creating: boolean;
  /** Resolves true when the invite was made, which closes the flow. */
  onCreate: (invite: NewInvite) => Promise<boolean>;
}

/** A "New invite" button that opens a short flow, one question per screen (owner, 2026-09-30). */
export function CreateInviteForm({ disabled, creating, onCreate }: CreateInviteFormProps) {
  const form = useCreateInviteForm();

  async function create() {
    if (await onCreate(form.invite())) form.close();
  }

  if (!form.open) {
    return (
      <Button className={`w-full h-11 mb-10 ${SMALL}`} onClick={form.start} disabled={disabled}>
        <Plus aria-hidden='true' />
        New invite
      </Button>
    );
  }
  return (
    <div role='group' aria-label='New invite' className='rounded-lg border bg-card/40 p-5 mb-10'>
      <div className='flex items-center justify-between mb-4'>
        {form.index > 0 ? (
          <Button type='button' variant='ghost' size='sm' onClick={form.back} className={`-ml-2 h-7 ${SMALL} text-muted-foreground`}>
            <ArrowLeft aria-hidden='true' />
            Back
          </Button>
        ) : <span />}
        <span className='text-xs text-muted-foreground'>Step {form.index + 1} of {form.total}</span>
        <Button type='button' variant='ghost' size='sm' onClick={form.close} className={`-mr-2 h-7 ${SMALL} text-muted-foreground`}>
          Cancel
        </Button>
      </div>
      <StepBody step={form.step} form={form} creating={creating} onCreate={() => void create()} />
    </div>
  );
}

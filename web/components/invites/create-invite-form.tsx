import { Link2 } from 'lucide-react';

import { GENERATED_CODE_LENGTHS, hasCode, type InviteKind } from '@pb/core';
import { ChoiceRow } from '@/components/invites/choice-row';
import { LifetimeRow, SameSwitch } from '@/components/invites/lifetime-picker';
import { Button } from '@/components/ui/button';
import { useCreateInviteForm } from '@/hooks/use-create-invite-form';
import type { NewInvite } from '@/lib/supabase/standing-invites';

const LABEL = 'text-xs tracking-widest uppercase text-muted-foreground';

// SCOPE A7: three kinds. Copy is the owner's (R7, the terse set, 2026-09-29).
const KINDS = [
  { value: 'both', label: 'Link + code' },
  { value: 'link', label: 'Link' },
  { value: 'code', label: 'Code' },
] as const satisfies readonly { value: InviteKind; label: string }[];

const LENGTHS = GENERATED_CODE_LENGTHS.map((n) => ({ value: n, label: `${n} digits` }));

interface CreateInviteFormProps {
  disabled: boolean;
  creating: boolean;
  onCreate: (invite: NewInvite) => void;
}

/** What kind of invite to make, how many digits its code has, and how long each half works (SCOPE A5, A7, A11). */
export function CreateInviteForm({ disabled, creating, onCreate }: CreateInviteFormProps) {
  const form = useCreateInviteForm();

  return (
    <div className='space-y-3 mb-10'>
      <p className={LABEL}>New invite</p>
      <ChoiceRow label='Invite kind' choices={KINDS} value={form.kind} onChange={form.setKind} />
      {hasCode(form.kind) && <ChoiceRow label='Code length' choices={LENGTHS} value={form.codeLength} onChange={form.setCodeLength} />}
      {form.kind === 'both' && <SameSwitch checked={form.same} onChange={form.setSame} />}
      {form.split ? (
        <>
          <LifetimeRow label='Link works for' value={form.link} onChange={form.setLink} />
          <LifetimeRow label='Code works for' value={form.code} onChange={form.setCode} />
        </>
      ) : (
        <LifetimeRow label='Works for' value={form.link} onChange={form.setBoth} />
      )}
      <Button className='w-full h-10 text-xs tracking-widest uppercase' onClick={() => onCreate(form.invite())} disabled={disabled || creating}>
        <Link2 aria-hidden='true' />
        {creating ? 'Creating…' : 'Create Invite'}
      </Button>
    </div>
  );
}

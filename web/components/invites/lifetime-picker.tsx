import { INVITE_LIFETIME_LABELS, INVITE_LIFETIMES, type InviteLifetime } from '@pb/core';
import { ChoiceRow } from '@/components/invites/choice-row';

const LABEL = 'text-xs text-muted-foreground';

const CHOICES = INVITE_LIFETIMES.map((value) => ({ value, label: INVITE_LIFETIME_LABELS[value] }));

interface LifetimeRowProps {
  label: string;
  value: InviteLifetime;
  onChange: (value: InviteLifetime) => void;
}

/** One lifetime pick: a caption, then the five choices (SCOPE A11). Copy is the owner's (R7, terse set). */
export function LifetimeRow({ label, value, onChange }: LifetimeRowProps) {
  return (
    <div className='space-y-1.5'>
      <p className={LABEL}>{label}</p>
      <ChoiceRow label={label} choices={CHOICES} value={value} onChange={onChange} compact />
    </div>
  );
}

interface SameSwitchProps {
  checked: boolean;
  onChange: (on: boolean) => void;
}

// host-features-setting.tsx's switch shape (a button with role="switch"; no Radix switch is
// installed), kept local because that file belongs to another feature.
export function SameSwitch({ checked, onChange }: SameSwitchProps) {
  return (
    <div className='flex items-center justify-between gap-4'>
      <label htmlFor='invite-same-lifetime' className='text-sm'>Same for both</label>
      <button
        id='invite-same-lifetime'
        type='button'
        role='switch'
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`inline-block size-4 rounded-full bg-foreground transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { formatBlinds, formatDate } from '@pb/core';
import { Check, Trash2 } from 'lucide-react';
import { signedAmount, toneClass } from '@/components/results/poker-result-row';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { useConfirm } from '@/hooks/use-confirm';
import { useLogSessionForm, type LogSessionField, type LogSessionForm as FormState } from '@/hooks/use-log-session-form';
import { LOGGED_SESSION_STAKES_PRESETS } from '@/lib/config';
import type { LoggedSessionRow } from '@/lib/supabase/logged-sessions';
import { cn } from '@/lib/utils';

const LABEL = 'text-xs tracking-widest uppercase text-muted-foreground mb-2 block';
const ACTION = 'w-full h-12 text-xs tracking-widest uppercase';
const POKER_TAB = '/results?tab=poker';

function Field({ id, label, problem, children }: { id: string; label: string; problem?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children}
      {problem && <p className='text-xs text-destructive mt-1'>{problem}</p>}
    </div>
  );
}

function Money({ form, field, id, label, placeholder }: { form: FormState; field: LogSessionField; id: string; label: string; placeholder?: string }) {
  const problem = form.problems[field];
  return (
    <Field id={id} label={label} problem={problem}>
      <MoneyInput id={id} value={form.fields[field]} onValueChange={(v) => form.set(field, v)} placeholder={placeholder} aria-invalid={!!problem} />
    </Field>
  );
}

function StakesChips({ form }: { form: FormState }) {
  return (
    <div className='flex flex-wrap gap-2 mt-2'>
      {LOGGED_SESSION_STAKES_PRESETS.map(({ smallCents, bigCents }) => (
        <button
          key={`${smallCents}/${bigCents}`}
          type='button'
          onClick={() => form.setBlinds(smallCents, bigCents)}
          className='h-11 min-w-11 rounded-full border border-border px-3 text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground active:bg-accent/10'
        >
          {formatBlinds(smallCents, bigCents, null)}
        </button>
      ))}
    </div>
  );
}

function Blinds({ form }: { form: FormState }) {
  return (
    <div>
      <div className='grid grid-cols-2 gap-3'>
        <Money form={form} field='small' id='log-small' label='Small blind' />
        <Money form={form} field='big' id='log-big' label='Big blind' />
      </div>
      <StakesChips form={form} />
    </div>
  );
}

function TextField({ form, field, id, label, list, placeholder, maxLength, inputMode }: {
  form: FormState; field: LogSessionField; id: string; label: string; list?: string; placeholder?: string; maxLength: number;
  inputMode?: 'decimal';
}) {
  return (
    <Field id={id} label={label} problem={form.problems[field]}>
      <Input id={id} list={list} value={form.fields[field]} onChange={(e) => form.set(field, e.target.value)} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} autoComplete='off' aria-invalid={!!form.problems[field]} />
    </Field>
  );
}

// The sign on screen before saving (DESIGN.md §5 H4): out for minus in for, won-positive.
function NetLine({ form }: { form: FormState }) {
  if (form.netCents === null) return null;
  return (
    <p className='text-sm tabular-nums'>
      Net <span className={cn('font-semibold', toneClass(form.netCents))}>{signedAmount(form.netCents)}</span>
      {form.perHourCents !== null && <span className={cn('ml-2 text-xs', toneClass(form.perHourCents))}>{signedAmount(form.perHourCents)}/hr</span>}
    </p>
  );
}

function Suggestions({ id, values }: { id: string; values: string[] }) {
  return <datalist id={id}>{values.map((v) => <option key={v} value={v} />)}</datalist>;
}

function Fields({ form }: { form: FormState }) {
  return (
    <>
      <TextField form={form} field='venue' id='log-venue' label='Where' list='log-venues' placeholder='Rivers Casino' maxLength={100} />
      <Suggestions id='log-venues' values={form.venues} />
      <Field id='log-date' label='When' problem={form.problems.date}>
        <Input id='log-date' type='date' max={form.today || undefined} value={form.fields.date} onChange={(e) => form.set('date', e.target.value)} className='h-11' aria-invalid={!!form.problems.date} />
      </Field>
      <Blinds form={form} />
      <div className='grid grid-cols-2 gap-3'>
        <Money form={form} field='straddle' id='log-straddle' label='Straddle' placeholder='Optional' />
        <TextField form={form} field='game' id='log-game' label='Game' list='log-games' placeholder='Optional' maxLength={40} />
      </div>
      <Suggestions id='log-games' values={form.games} />
      <div className='grid grid-cols-2 gap-3'>
        <Money form={form} field='buyIn' id='log-in' label='In for' />
        <Money form={form} field='cashOut' id='log-out' label='Out for' />
      </div>
      <TextField form={form} field='hours' id='log-hours' label='Hours' placeholder='Optional' maxLength={6} inputMode='decimal' />
      <Field id='log-note' label='Note'>
        <textarea
          id='log-note'
          value={form.fields.note}
          onChange={(e) => form.set('note', e.target.value)}
          maxLength={500}
          rows={3}
          placeholder='Optional'
          className='w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30'
        />
      </Field>
    </>
  );
}

function useDelete(form: FormState, existing: LoggedSessionRow, done: () => void) {
  const { confirm, confirmDialog } = useConfirm();
  async function remove() {
    const ok = await confirm({
      title: 'Delete this session?',
      description: `${existing.venue} on ${formatDate(existing.played_on)}. Your results go back to what they were without it.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await form.remove();
      done();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return { remove, confirmDialog };
}

function DeleteButton({ form, existing, done }: { form: FormState; existing: LoggedSessionRow; done: () => void }) {
  const { remove, confirmDialog } = useDelete(form, existing, done);
  return (
    <>
      <Button type='button' variant='outline' size='lg' className={cn(ACTION, 'text-destructive')} disabled={form.busy} onClick={remove}>
        <Trash2 aria-hidden='true' />
        Delete session
      </Button>
      {confirmDialog}
    </>
  );
}

/**
 * Log a game played away from any table, or fix or remove one (logged-sessions PLAN.md phase 2,
 * BD-1). Saving or deleting returns to the poker tab, whose list and net move by the change.
 */
export function LogSessionForm({ existing }: { existing?: LoggedSessionRow }) {
  const form = useLogSessionForm(existing);
  const router = useRouter();
  const done = () => router.replace(POKER_TAB);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.canSave) return;
    try {
      await form.save();
      done();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <Fields form={form} />
      <NetLine form={form} />
      <Button type='submit' size='lg' className={ACTION} disabled={!form.canSave}>
        <Check aria-hidden='true' />
        {form.busy ? 'Saving…' : 'Save'}
      </Button>
      {existing && <DeleteButton form={form} existing={existing} done={done} />}
    </form>
  );
}

'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { formatDate, typeLabel, type EventType, type ExtraField } from '@pb/core';
import { Check, Trash2 } from 'lucide-react';
import { signedAmount, toneClass } from '@/components/results/poker-result-row';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { useConfirm } from '@/hooks/use-confirm';
import { EVENT_TITLE_MAX, useLogEventForm, type LogEventField, type LogEventForm as FormState } from '@/hooks/use-log-event-form';
import type { LoggedEventRow } from '@/lib/supabase/logged-events';
import { cn } from '@/lib/utils';

const LABEL = 'text-xs tracking-widest uppercase text-muted-foreground mb-2 block';
const ACTION = 'w-full h-12 text-xs tracking-widest uppercase';
// log-events PLAN.md BD-5: an event lands on the combined tab, not poker's.
const EVERYTHING_TAB = '/results?tab=everything';
// Mirrors 0027's checks: place 1–100, sport and bet type 40 (the zod schema), note 500.
const PLACE_MAX = 100;
const EXTRA_TEXT_MAX = 40;

function Field({ id, label, problem, children }: { id: string; label: string; problem?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children}
      {problem && <p className='text-xs text-destructive mt-1'>{problem}</p>}
    </div>
  );
}

function Money({ form, field, label, placeholder }: { form: FormState; field: LogEventField; label: string; placeholder?: string }) {
  const id = `event-${field}`;
  const problem = form.problems[field];
  return (
    <Field id={id} label={label} problem={problem}>
      <MoneyInput id={id} value={form.fields[field]} onValueChange={(v) => form.set(field, v)} placeholder={placeholder} aria-invalid={!!problem} />
    </Field>
  );
}

function TextField({ form, field, label, list, placeholder, maxLength, inputMode }: {
  form: FormState; field: LogEventField; label: string; list?: string; placeholder?: string; maxLength: number;
  inputMode?: 'decimal' | 'text';
}) {
  const id = `event-${field}`;
  const problem = form.problems[field];
  return (
    <Field id={id} label={label} problem={problem}>
      <Input id={id} list={list} value={form.fields[field]} onChange={(e) => form.set(field, e.target.value)} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} autoComplete='off' aria-invalid={!!problem} />
    </Field>
  );
}

// Odds need a minus sign, which the decimal keypad lacks on iOS, so they take the text keyboard.
function Extra({ form, extra }: { form: FormState; extra: ExtraField }) {
  if (extra.kind === 'money') return <Money form={form} field={extra.key} label={extra.label} placeholder='Optional' />;
  const odds = extra.kind === 'odds';
  return (
    <TextField form={form} field={extra.key} label={extra.label} placeholder={odds ? '-110' : 'Optional'} maxLength={odds ? 7 : EXTRA_TEXT_MAX} inputMode={odds ? 'text' : undefined} />
  );
}

// The sign on screen before saving (SCOPE H1): got back minus put in, won-positive. A book's
// payout includes the stake, so a player who typed their profit sees a push here, not a win.
function NetLine({ form }: { form: FormState }) {
  if (form.netCents === null) return null;
  return (
    <p className='text-sm tabular-nums'>
      Net <span className={cn('font-semibold', toneClass(form.netCents))}>{signedAmount(form.netCents)}</span>
      {form.perHourCents !== null && <span className={cn('ml-2 text-xs', toneClass(form.perHourCents))}>{signedAmount(form.perHourCents)}/hr</span>}
    </p>
  );
}

function Place({ form }: { form: FormState }) {
  const { type } = form;
  return (
    <>
      <TextField form={form} field='place' label={type.placeLabel} list='event-places' placeholder={type.placeRequired ? undefined : 'Optional'} maxLength={PLACE_MAX} />
      <datalist id='event-places'>{form.places.map((v) => <option key={v} value={v} />)}</datalist>
    </>
  );
}

function Fields({ form }: { form: FormState }) {
  const { type } = form;
  return (
    <>
      {type.titleRequired && <TextField form={form} field='title' label='Name' placeholder='Pai gow' maxLength={EVENT_TITLE_MAX} />}
      <Place form={form} />
      <Field id='event-date' label='When' problem={form.problems.date}>
        <Input id='event-date' type='date' max={form.today || undefined} value={form.fields.date} onChange={(e) => form.set('date', e.target.value)} className='h-11' aria-invalid={!!form.problems.date} />
      </Field>
      {type.extras.map((extra) => <Extra key={extra.key} form={form} extra={extra} />)}
      {/* One per row, not poker's side-by-side pair: "Got back (with your stake)" wraps at phone
          width, and the words after the wrap are the guard against typing profit (SCOPE H1). */}
      <Money form={form} field='stake' label={type.inLabel} />
      <Money form={form} field='payout' label={type.outLabel} />
      {type.asksHours && <TextField form={form} field='hours' label='Hours' placeholder='Optional' maxLength={6} inputMode='decimal' />}
      <Field id='event-note' label='Note'>
        <textarea
          id='event-note'
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

function describe(row: LoggedEventRow): string {
  const what = row.title ?? typeLabel(row.event_type);
  return row.place ? `${what} at ${row.place} on ${formatDate(row.played_on)}` : `${what} on ${formatDate(row.played_on)}`;
}

function DeleteButton({ form, existing, done }: { form: FormState; existing: LoggedEventRow; done: () => void }) {
  const { confirm, confirmDialog } = useConfirm();
  async function remove() {
    const ok = await confirm({
      title: 'Delete this event?',
      description: `${describe(existing)}. Your results go back to what they were without it.`,
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
  return (
    <>
      <Button type='button' variant='outline' size='lg' className={cn(ACTION, 'text-destructive')} disabled={form.busy} onClick={remove}>
        <Trash2 aria-hidden='true' />
        Delete event
      </Button>
      {confirmDialog}
    </>
  );
}

/**
 * Log a result that is not poker, or fix or remove one (log-events PLAN.md phase 2 step 3). The
 * fields come from the type's registry entry; saving or deleting returns to the Everything tab.
 */
export function LogEventForm({ type, existing }: { type: EventType; existing?: LoggedEventRow }) {
  const form = useLogEventForm(type, existing);
  const router = useRouter();
  const done = () => router.replace(EVERYTHING_TAB);

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

  // Delete sits outside the <form>: its confirm dialog is a form too, and React carries that
  // submit through the portal to this form's onSubmit, which would save the fields first.
  return (
    <div className='space-y-6'>
      <form onSubmit={handleSubmit} className='space-y-6'>
        <Fields form={form} />
        <NetLine form={form} />
        <Button type='submit' size='lg' className={ACTION} disabled={!form.canSave}>
          <Check aria-hidden='true' />
          {form.busy ? 'Saving…' : 'Save'}
        </Button>
      </form>
      {existing && <DeleteButton form={form} existing={existing} done={done} />}
    </div>
  );
}

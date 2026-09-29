'use client';

import { formatCents } from '@pb/core';
import { ArrowRight, Trash2, X } from 'lucide-react';
import { useDeleteAccount, type DeleteAccountState } from '@/hooks/use-delete-account';
import type { BarAmount } from '@/lib/supabase/account-deletion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Copy is the plain register (owner, 2026-09-29); the words themselves are open for the owner (R7).
const dollars = (cents: number) => `$${formatCents(cents)}`;
const total = (rows: BarAmount[]) => rows.reduce((sum, r) => sum + r.cents, 0);

function AmountList({ rows }: { rows: BarAmount[] }) {
  return (
    <ul className='text-sm space-y-1'>
      {rows.map((r) => (
        <li key={r.barName} className='flex justify-between gap-4'>
          <span className='truncate'>{r.barName}</span>
          <span className='tabular-nums'>{dollars(r.cents)}</span>
        </li>
      ))}
    </ul>
  );
}

function Blocked({ state }: { state: DeleteAccountState }) {
  const { owes, barsWithHistory } = state.check ?? { owes: [], barsWithHistory: [] };
  return (
    <div className='space-y-3'>
      <p className='text-sm font-medium'>You can&apos;t delete your account yet.</p>
      {owes.length > 0 && (
        <>
          <p className='text-xs text-muted-foreground'>You owe {dollars(total(owes))}. Pay it, then come back.</p>
          <AmountList rows={owes} />
        </>
      )}
      {barsWithHistory.length > 0 && (
        <p className='text-xs text-muted-foreground'>
          You own {barsWithHistory.join(', ')}, which has game history. That history can&apos;t be deleted from here.
        </p>
      )}
      <Button variant='outline' className='w-full h-10 text-xs tracking-widest uppercase' onClick={state.cancel}><X aria-hidden='true' /> Close</Button>
    </div>
  );
}

function OwedWarning({ state }: { state: DeleteAccountState }) {
  const owed = state.check?.owed ?? [];
  return (
    <div className='space-y-3'>
      <p className='text-sm font-medium'>You&apos;re owed {dollars(total(owed))}.</p>
      <AmountList rows={owed} />
      <p className='text-xs text-muted-foreground'>
        If you delete your account you can no longer collect this here. Continue anyway?
      </p>
      <div className='flex gap-2'>
        <Button variant='outline' className='flex-1 h-10 text-xs tracking-widest uppercase' onClick={state.cancel}><X aria-hidden='true' /> Cancel</Button>
        <Button variant='destructive' className='flex-1 h-10 text-xs tracking-widest uppercase' onClick={state.continueAnyway}><ArrowRight aria-hidden='true' /> Continue</Button>
      </div>
    </div>
  );
}

function ConfirmEmail({ state }: { state: DeleteAccountState }) {
  const deleting = state.step === 'deleting';
  return (
    <div className='space-y-3'>
      <Label htmlFor='confirm-email' className='block text-xs leading-relaxed text-muted-foreground'>
        This can&apos;t be undone. Type{' '}
        <span className='break-all text-foreground'>{state.email}</span> to confirm.
      </Label>
      <Input
        id='confirm-email'
        type='email'
        autoComplete='off'
        value={state.typed}
        onChange={(e) => state.setTyped(e.target.value)}
        disabled={deleting}
        className='h-11'
      />
      <div className='flex gap-2'>
        <Button variant='outline' className='flex-1 h-10 text-xs tracking-widest uppercase' onClick={state.cancel} disabled={deleting}><X aria-hidden='true' /> Cancel</Button>
        <Button variant='destructive' className='flex-1 h-10 text-xs tracking-widest uppercase' onClick={state.remove} disabled={!state.matches || deleting}>
          <Trash2 aria-hidden='true' />
          {deleting ? 'Deleting…' : 'Delete account'}
        </Button>
      </div>
    </div>
  );
}

function Step({ state }: { state: DeleteAccountState }) {
  if (state.step === 'blocked') return <Blocked state={state} />;
  if (state.step === 'warn') return <OwedWarning state={state} />;
  return <ConfirmEmail state={state} />;
}

export function DeleteAccountSetting() {
  const state = useDeleteAccount();
  const idle = state.step === 'closed' || state.step === 'loading';

  return (
    <div className='border border-destructive/40 rounded-md p-4 mb-6 space-y-3'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>Delete account</p>
      {idle && (
        <>
          <p className='text-xs text-muted-foreground'>
            Permanently deletes your account. Your name and history stay on any host&apos;s books so their totals still add up.
          </p>
          <Button variant='destructive' className='w-full h-10 text-xs tracking-widest uppercase' onClick={state.open} disabled={state.step === 'loading'}>
            <Trash2 aria-hidden='true' />
            {state.step === 'loading' ? 'Checking…' : 'Delete account'}
          </Button>
        </>
      )}
      {!idle && <Step state={state} />}
      {state.error && <p className='text-xs text-destructive'>{state.error}</p>}
    </div>
  );
}

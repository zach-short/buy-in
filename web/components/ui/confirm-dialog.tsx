'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** A word the user must type before confirm enables — for deletes that cannot be undone. */
  requireText?: string;
}

interface ConfirmDialogProps {
  /** `null` is closed. */
  options: ConfirmOptions | null;
  onResolve: (confirmed: boolean) => void;
}

// Case and surrounding spaces are ignored, as in delete-account: the point is deliberateness.
function typedMatches(typed: string, required: string): boolean {
  return typed.trim().toLowerCase() === required.trim().toLowerCase();
}

const ACTION_CLASS = 'flex-1 h-11 text-xs tracking-widest uppercase';

// Mounted only while open, so the typed text resets with every new question.
function ConfirmBody({ options, onResolve }: { options: ConfirmOptions; onResolve: (confirmed: boolean) => void }) {
  const [typed, setTyped] = React.useState('');
  const { requireText } = options;
  const ready = !requireText || typedMatches(typed, requireText);

  return (
    <form
      className='space-y-4'
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onResolve(true);
      }}
    >
      <div className='space-y-2'>
        <DialogPrimitive.Title className='text-base font-medium'>{options.title}</DialogPrimitive.Title>
        {options.description && (
          <DialogPrimitive.Description className='text-sm text-muted-foreground'>
            {options.description}
          </DialogPrimitive.Description>
        )}
      </div>
      {requireText && (
        <label className='block space-y-2'>
          <span className='block text-xs text-muted-foreground'>
            Type <span className='text-foreground'>{requireText}</span> to confirm.
          </span>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete='off'
            autoCapitalize='off'
            autoCorrect='off'
            spellCheck={false}
            enterKeyHint='done'
            className='h-11'
          />
        </label>
      )}
      {/* Cancel first in DOM order, so it — not the destructive action — takes initial focus. */}
      <div className='flex gap-2'>
        <Button type='button' variant='outline' className={ACTION_CLASS} onClick={() => onResolve(false)}>
          <X aria-hidden='true' />
          {options.cancelLabel ?? 'Cancel'}
        </Button>
        <Button type='submit' variant={options.destructive ? 'destructive' : 'default'} className={ACTION_CLASS} disabled={!ready}>
          <Check aria-hidden='true' />
          {options.confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </form>
  );
}

/** Controlled yes/no dialog. Pages should not render this directly — use `useConfirm`. */
export function ConfirmDialog({ options, onResolve }: ConfirmDialogProps) {
  return (
    <DialogPrimitive.Root open={options !== null} onOpenChange={(open) => !open && onResolve(false)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className='fixed inset-0 z-50 bg-black/70' />
        <DialogPrimitive.Content
          // Radix warns without a description; opt out explicitly when there is none.
          {...(options?.description ? {} : { 'aria-describedby': undefined })}
          // Bottom sheet on phones (reachable one-handed), centred card from `sm` up.
          className='fixed inset-x-0 bottom-0 z-50 rounded-t-lg border border-border bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-card-foreground shadow-lg outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:pb-6'
        >
          {options && <ConfirmBody options={options} onResolve={onResolve} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

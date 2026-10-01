'use client';

import { useFormStatus } from 'react-dom';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';

// Disabled while the verify runs: the token works once, so a second tap would fail and could
// replace the set-password page with the expired state.
export function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type='submit' disabled={pending} className='w-full h-11 tracking-widest uppercase text-xs'>
      <KeyRound aria-hidden='true' />
      {pending ? 'Opening…' : 'Set a new password'}
    </Button>
  );
}

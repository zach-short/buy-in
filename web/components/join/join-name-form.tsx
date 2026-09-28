'use client';

import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { JoinFlow } from '@/hooks/use-join-flow';

/** The display-name step: the name the host sees on their player list, then the join itself. */
export function JoinNameForm({ flow, token }: { flow: JoinFlow; token: string }) {
  const joining = flow.step === 'joining';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void flow.join(token);
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-3'>
      <Label htmlFor='join-name' className='text-xs text-muted-foreground tracking-widest uppercase'>
        Your name at the table
      </Label>
      <Input
        id='join-name'
        placeholder='Display name'
        value={flow.name}
        onChange={(e) => flow.setName(e.target.value)}
        autoComplete='name'
        className='h-11'
      />
      {flow.error && (
        <p role='alert' className='text-xs text-destructive tracking-wide'>
          {flow.error}
        </p>
      )}
      <Button type='submit' className='w-full h-11 tracking-widest uppercase text-xs' disabled={joining}>
        {joining ? 'Joining…' : 'Join table'}
      </Button>
    </form>
  );
}

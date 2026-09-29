'use client';

import { use, useState, type FormEvent } from 'react';

import { JoinNameForm } from '@/components/join/join-name-form';
import { JoinShell } from '@/components/join/join-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useJoinFlow } from '@/hooks/use-join-flow';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// The typed-code way in; /join/[token] is the same flow for a clicked link. A signed-out
// visitor is sent to /login and returned here with ?code= set, so the code survives the detour.
export default function JoinPage({ searchParams }: { searchParams: SearchParams }) {
  const { code: codeParam } = use(searchParams);
  const [code, setCode] = useState(typeof codeParam === 'string' ? codeParam : '');
  const flow = useJoinFlow();
  const token = code.trim();

  if (flow.step === 'naming' || flow.step === 'joining') {
    return (
      <JoinShell>
        <p className='text-sm text-muted-foreground'>Choose the name your host will see.</p>
        <JoinNameForm flow={flow} token={token} />
        <Button variant='ghost' className='w-full text-xs tracking-widest uppercase' onClick={flow.reset}>
          Use a different code
        </Button>
      </JoinShell>
    );
  }

  const busy = flow.step === 'checking' || flow.step === 'redirecting';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (token) void flow.begin(`/join?${new URLSearchParams({ code: token })}`);
  }

  return (
    <JoinShell>
      <form onSubmit={handleSubmit} className='space-y-3'>
        <Input
          placeholder='Invite code'
          aria-label='Invite code'
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete='off'
          autoCapitalize='none'
          spellCheck={false}
          className='h-11'
        />
        {flow.error ? (
          <p role='alert' className='text-xs text-destructive tracking-wide'>
            {flow.error}
          </p>
        ) : (
          <p className='text-xs text-muted-foreground tracking-wide'>
            Your host can send you an invite link or code.
          </p>
        )}
        <Button type='submit' className='w-full h-11 tracking-widest uppercase text-xs' disabled={busy || !token}>
          {busy ? 'Checking…' : 'Continue'}
        </Button>
      </form>
    </JoinShell>
  );
}

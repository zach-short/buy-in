'use client';

import { use, useEffect, useRef, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';

import { JoinShell } from '@/components/join/join-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInviteCodeEntry } from '@/hooks/use-invite-code-entry';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// The typed-code way in. A code (0028) or a pasted link token both end at /join/[token], so the
// name form and the claim picker live in one place. A signed-out visitor is sent to /login and
// returned here with ?code= set; arriving with one is the request itself, so it runs on arrival,
// as the token page's sign-in check does.
export default function JoinPage({ searchParams }: { searchParams: SearchParams }) {
  const { code: codeParam } = use(searchParams);
  const initial = typeof codeParam === 'string' ? codeParam : '';
  const entry = useInviteCodeEntry(initial);
  const { submit } = entry;
  const busy = entry.step !== 'idle';
  // Once per arrival: a wrong code costs a try, and Strict Mode runs effects twice in dev.
  const arrived = useRef(false);

  useEffect(() => {
    if (!initial || arrived.current) return;
    arrived.current = true;
    void submit(initial);
  }, [initial, submit]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(entry.code);
  }

  return (
    <JoinShell>
      <form onSubmit={handleSubmit} className='space-y-3'>
        <Input
          placeholder='Invite code'
          aria-label='Invite code'
          value={entry.code}
          onChange={(e) => entry.setCode(e.target.value)}
          autoComplete='off'
          autoCapitalize='characters'
          spellCheck={false}
          autoFocus
          enterKeyHint='go'
          className='h-11 font-mono tracking-widest'
        />
        {entry.error ? (
          <p role='alert' className='text-xs text-destructive tracking-wide'>
            {entry.error}
          </p>
        ) : (
          <p className='text-xs text-muted-foreground tracking-wide'>
            Your host can send you an invite link or code.
          </p>
        )}
        <Button type='submit' className='w-full h-11 tracking-widest uppercase text-xs' disabled={busy || !entry.code.trim()}>
          <ArrowRight aria-hidden='true' />
          {entry.step === 'redirecting' ? 'Taking you to sign in…' : busy ? 'Checking…' : 'Continue'}
        </Button>
      </form>
    </JoinShell>
  );
}

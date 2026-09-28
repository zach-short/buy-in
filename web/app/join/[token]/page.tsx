'use client';

import { use, useEffect } from 'react';

import { JoinNameForm } from '@/components/join/join-name-form';
import { JoinShell, JoinStatus } from '@/components/join/join-shell';
import { Button } from '@/components/ui/button';
import { useJoinFlow } from '@/hooks/use-join-flow';

// The clicked-link way in; /join is the same flow for a typed code. No RPC reveals a bar by its
// token, so the invitation stays generic rather than naming the table — a lookup would be a
// new schema function, and a bar's name is exactly what invites exist to keep private.
export default function JoinInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const flow = useJoinFlow('checking');
  const { begin } = flow;
  const returnTo = `/join/${encodeURIComponent(token)}`;

  // The link itself is the request to join, so the sign-in check runs on arrival.
  useEffect(() => {
    void begin(returnTo);
  }, [begin, returnTo]);

  if (flow.step === 'naming' || flow.step === 'joining') {
    return (
      <JoinShell>
        <p className='text-center text-sm'>You&apos;ve been invited to join a poker table.</p>
        <JoinNameForm flow={flow} token={token} />
      </JoinShell>
    );
  }

  if (flow.error) {
    return (
      <JoinShell>
        <p role='alert' className='text-center text-xs text-destructive tracking-wide'>
          {flow.error}
        </p>
        <Button className='w-full h-11 tracking-widest uppercase text-xs' onClick={() => void begin(returnTo)}>
          Try again
        </Button>
      </JoinShell>
    );
  }

  return <JoinStatus>{flow.step === 'redirecting' ? 'Taking you to sign up…' : 'Loading…'}</JoinStatus>;
}

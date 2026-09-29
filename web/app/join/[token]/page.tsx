'use client';

import { use, useEffect } from 'react';

import { JoinNameForm } from '@/components/join/join-name-form';
import { JoinShell, JoinStatus } from '@/components/join/join-shell';
import { Button } from '@/components/ui/button';
import { useJoinFlow } from '@/hooks/use-join-flow';

// The clicked-link way in; /join is the same flow for a typed code. The link's unfurled card
// names the table and game night (get_invite_preview, 0005, owner 2026-09-29); the page itself
// stays generic until the visitor has signed in and joined.
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

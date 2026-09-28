'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import type { PostgrestError } from '@supabase/supabase-js';

import { Button } from '@/components/ui/button';
import { useAuthUser } from '@/hooks/use-auth-user';
import { createClient } from '@/lib/supabase/client';

type RsvpStatus = 'yes' | 'no' | 'maybe';

interface Choice {
  status: RsvpStatus;
  label: string;
  confirmation: string;
}

const CHOICES: readonly Choice[] = [
  { status: 'yes', label: "I'm in", confirmation: "You're in! See you then." },
  { status: 'no', label: "Can't make it", confirmation: 'Thanks for letting the host know.' },
  { status: 'maybe', label: 'Maybe', confirmation: 'Marked as maybe.' },
];

// A dead link fails identically on every click, so it replaces the buttons; any other failure
// may be a dropped connection, so the buttons stay for another try.
interface RsvpError {
  fatal: boolean;
  message: string;
}

interface RsvpState {
  saved: RsvpStatus | null;
  pending: RsvpStatus | null;
  error: RsvpError | null;
}

// No RPC looks a token up without answering it, so a bad link only surfaces on the first click.
// The match is loose because the raise wording belongs to the schema: 0001's share links say
// 'invalid or expired link', and a standing-table invite opened here says 'not an event invite'.
function rsvpError(error: PostgrestError): RsvpError {
  const message = error.message.toLowerCase();
  if (message.includes('not an event invite')) {
    return { fatal: true, message: "This link invites you to join a table, not to a game night. Ask the host for the game night's link." };
  }
  if (/invalid|expired|revoked|not found/.test(message)) {
    return { fatal: true, message: 'This invite link is invalid or has expired. Ask the host for a new one.' };
  }
  return { fatal: false, message: "Couldn't save your answer. Try again in a moment." };
}

// rsvp_scheduled_game upserts, so changing an answer is the same call with another status.
async function submitRsvp(token: string, status: RsvpStatus): Promise<RsvpError | null> {
  const { error } = await createClient().rpc('rsvp_scheduled_game', { p_token: token, p_status: status });
  return error ? rsvpError(error) : null;
}

export default function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const auth = useAuthUser();

  return (
    <main className='min-h-screen flex flex-col items-center justify-center px-6'>
      <div className='w-full max-w-xs space-y-8'>
        <div className='text-center space-y-1'>
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>Game night</p>
        </div>
        {auth.status === 'loading' && (
          <p className='text-center text-muted-foreground text-sm tracking-widest'>Loading…</p>
        )}
        {auth.status === 'unauthenticated' && <SignInPrompt token={token} />}
        {auth.status === 'authenticated' && <RsvpChoices token={token} />}
      </div>
    </main>
  );
}

function InviteLine() {
  return <p className='text-center text-sm'>You&apos;ve been invited to a poker game night.</p>;
}

// Links rather than a redirect, so the token survives: login and signup bring the visitor back
// here through `redirect`, and this page has nothing to show about the game until they do.
function SignInPrompt({ token }: { token: string }) {
  const redirect = encodeURIComponent(`/rsvp/${token}`);
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <InviteLine />
        <p className='text-center text-xs text-muted-foreground'>Sign in or create an account to RSVP.</p>
      </div>
      <div className='space-y-3'>
        <Button asChild className='w-full h-11 tracking-widest uppercase text-xs'>
          <Link href={`/signup?redirect=${redirect}`}>Create an account</Link>
        </Button>
        <Button asChild variant='outline' className='w-full h-11 tracking-widest uppercase text-xs'>
          <Link href={`/login?redirect=${redirect}`}>I already have an account</Link>
        </Button>
      </div>
    </div>
  );
}

function RsvpChoices({ token }: { token: string }) {
  const [state, setState] = useState<RsvpState>({ saved: null, pending: null, error: null });

  async function answer(status: RsvpStatus) {
    setState((s) => ({ ...s, pending: status, error: null }));
    const error = await submitRsvp(token, status);
    setState((s) => ({ saved: error ? s.saved : status, pending: null, error }));
  }

  if (state.error?.fatal) return <InvalidInvite message={state.error.message} />;
  const confirmation = CHOICES.find((c) => c.status === state.saved)?.confirmation;

  return (
    <div className='space-y-6'>
      <InviteLine />
      <div className='space-y-3'>
        {CHOICES.map((choice) => (
          <Button
            key={choice.status}
            variant={state.saved === choice.status ? 'default' : 'outline'}
            aria-pressed={state.saved === choice.status}
            disabled={state.pending !== null}
            onClick={() => void answer(choice.status)}
            className='w-full h-11 tracking-widest uppercase text-xs'
          >
            {state.pending === choice.status ? 'Saving…' : choice.label}
          </Button>
        ))}
      </div>
      {confirmation && (
        <div role='status' className='text-center space-y-1'>
          <p className='text-sm text-primary'>{confirmation}</p>
          <p className='text-xs text-muted-foreground'>Plans change? Pick another answer anytime.</p>
        </div>
      )}
      {state.error && (
        <p role='alert' className='text-center text-xs text-destructive tracking-wide'>{state.error.message}</p>
      )}
    </div>
  );
}

function InvalidInvite({ message }: { message: string }) {
  return (
    <div role='alert' className='text-center space-y-2'>
      <p className='text-sm font-medium text-destructive'>Invalid link</p>
      <p className='text-xs text-muted-foreground'>{message}</p>
    </div>
  );
}

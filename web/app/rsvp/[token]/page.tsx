'use client';

import { use, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';

import { formatDate, formatTime } from '@pb/core';
import { ArrowRight, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthUser } from '@/hooks/use-auth-user';
import { buildIcs, icsDataUrl, type IcsEvent } from '@/lib/ics';
import { submitRsvp, type RsvpError, type RsvpGame, type RsvpStatus } from '@/lib/supabase/rsvp';

import { useRsvpGame } from './use-rsvp-game';

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

interface RsvpState {
  saved: RsvpStatus | null;
  pending: RsvpStatus | null;
  error: RsvpError | null;
}

export default function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const auth = useAuthUser();

  return (
    <main className='min-h-dvh flex flex-col items-center justify-center px-6'>
      <div className='w-full max-w-xs space-y-8'>
        <div className='text-center space-y-1'>
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>Game night</p>
        </div>
        {auth.status === 'loading' && <Loading />}
        {auth.status === 'unauthenticated' && <SignInPrompt token={token} />}
        {auth.status === 'authenticated' && <RsvpForGame token={token} />}
      </div>
    </main>
  );
}

function Loading() {
  return <p className='text-center text-muted-foreground text-sm tracking-widest'>Loading…</p>;
}

function InviteLine() {
  return <p className='text-center text-sm'>You&apos;ve been invited to a poker game night.</p>;
}

// A link rather than a redirect, so the token survives: /login brings the visitor back here
// through `redirect`, whether they sign in or sign up. get_rsvp_game (0012) needs an account, so the game's details wait too.
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
          <Link href={`/login?redirect=${redirect}`}><ArrowRight aria-hidden='true' /> Continue</Link>
        </Button>
      </div>
    </div>
  );
}

// `unknown` is 0012 unapplied (or unreachable): the page as it was before, a bare invite line
// with nothing preselected, where a bad link only surfaces on the first click.
function RsvpForGame({ token }: { token: string }) {
  const result = useRsvpGame(token);
  if (!result) return <Loading />;
  if (result.kind === 'invalid') return <InvalidInvite message={result.error.message} />;
  if (result.kind === 'unknown') return <RsvpChoices token={token} intro={<InviteLine />} initial={null} calendar={null} />;

  const { game } = result;
  if (game.cancelled) {
    return (
      <div className='space-y-6'>
        <GameDetails game={game} />
        <p role='status' className='text-center text-sm font-medium text-destructive'>This game was cancelled.</p>
      </div>
    );
  }
  const intro = (
    <div className='space-y-3'>
      <GameDetails game={game} />
      {game.started && <p className='text-center text-xs text-muted-foreground'>This game is already under way.</p>}
    </div>
  );
  return <RsvpChoices token={token} intro={intro} initial={game.myStatus} calendar={game.started ? null : calendarEvent(game)} />;
}

function calendarEvent(game: RsvpGame): IcsEvent {
  const host = game.hostName ? `, hosted by ${game.hostName}` : '';
  return { title: game.name, start: game.scheduledAt, description: `Poker at ${game.barName}${host}.` };
}

// Shown in the guest's own timezone: this renders in their browser, after sign-in.
function GameDetails({ game }: { game: RsvpGame }) {
  return (
    <div className='text-center space-y-1'>
      <p className='text-lg font-semibold'>{game.name}</p>
      <p className='text-sm'>{formatDate(game.scheduledAt)} · {formatTime(game.scheduledAt)}</p>
      <p className='text-xs text-muted-foreground'>
        {game.barName}
        {game.hostName && <> · Hosted by {game.hostName}</>}
      </p>
    </div>
  );
}

interface RsvpChoicesProps {
  token: string;
  intro: ReactNode;
  initial: RsvpStatus | null;
  /** Offered once the answer is yes; null where there is nothing to put in a calendar. */
  calendar: IcsEvent | null;
}

function RsvpChoices({ token, intro, initial, calendar }: RsvpChoicesProps) {
  const [state, setState] = useState<RsvpState>({ saved: initial, pending: null, error: null });
  // The saved answer arrives with the page, so no confirmation shows until the guest taps.
  const [answered, setAnswered] = useState(false);

  async function answer(status: RsvpStatus) {
    setState((s) => ({ ...s, pending: status, error: null }));
    const error = await submitRsvp(token, status);
    setState((s) => ({ saved: error ? s.saved : status, pending: null, error }));
    if (!error) setAnswered(true);
  }

  if (state.error?.fatal) return <InvalidInvite message={state.error.message} />;
  const confirmation = answered ? CHOICES.find((c) => c.status === state.saved)?.confirmation : undefined;

  return (
    <div className='space-y-6'>
      {intro}
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
      {calendar && state.saved === 'yes' && <CalendarLink event={calendar} />}
      {state.error && (
        <p role='alert' className='text-center text-xs text-destructive tracking-wide'>{state.error.message}</p>
      )}
    </div>
  );
}

function CalendarLink({ event }: { event: IcsEvent }) {
  // Keyed on the fields, not the object: buildIcs stamps a fresh UID, which a re-render that
  // rebuilds an identical event should not change.
  const { title, start, description } = event;
  const href = useMemo(() => icsDataUrl(buildIcs({ title, start, description })), [title, start, description]);
  return (
    <Button asChild variant='outline' className='w-full h-11 tracking-widest uppercase text-xs'>
      <a href={href} download='game-night.ics'><CalendarPlus aria-hidden='true' /> Add to calendar</a>
    </Button>
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

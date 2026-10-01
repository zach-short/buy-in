'use client';

import { Suspense, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, KeyRound, LogIn, Mail, Send } from 'lucide-react';

import { GoogleButton } from '@/components/auth/google-button';
import { PasswordInput } from '@/components/auth/password-input';
import { LegalLinks } from '@/components/legal/legal-links';
import { StatusScreen } from '@/components/shared/status-screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogin, type LoginFlow } from '@/hooks/use-login';
import { cn } from '@/lib/utils';

const PRIMARY = 'w-full h-11 tracking-widest uppercase text-xs';

// useSearchParams() forces this subtree to opt out of static prerendering; Next.js
// requires a Suspense boundary around it (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).
export default function LoginPage() {
  return (
    <Suspense fallback={<StatusScreen kind='loading' />}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const flow = useLogin();
  const confirmed = useSearchParams().get('confirmed');
  const entry = flow.step === 'start' || flow.step === 'email';

  return (
    <main className='min-h-dvh flex flex-col items-center justify-center px-6 py-12'>
      <div className='w-full max-w-xs'>
        <h1 className='pb-8 text-center text-2xl font-semibold tracking-widest uppercase text-primary'>
          <Link href='/'>Buy-In</Link>
        </h1>
        {confirmed && (
          <FadeAway gone={flow.step !== 'start'}>
            <p className='pb-8 text-center text-xs text-muted-foreground tracking-wide'>
              Your email is confirmed. Sign in to continue.
            </p>
          </FadeAway>
        )}
        {entry && <EntryStep flow={flow} />}
        {flow.step === 'password' && <PasswordStep flow={flow} />}
        {flow.step === 'create' && <CreateStep flow={flow} />}
        {flow.step === 'reset' && <ResetStep flow={flow} />}
        {flow.step === 'reset-sent' && <ResetSentStep flow={flow} />}
      </div>
      {/* In the flow, not pinned to the bottom, so a tall form on a short screen cannot run under it. */}
      <LegalLinks className='mt-8' />
    </main>
  );
}

// Collapses its height as it fades, so what sits below slides up into the space it leaves.
// `inert` keeps the faded content out of the tab order and away from screen readers.
function FadeAway({ gone, children }: { gone: boolean; children: ReactNode }) {
  return (
    <div
      inert={gone}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
        gone ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
      )}
    >
      <div className='overflow-hidden'>{children}</div>
    </div>
  );
}

// Google first (owner, 2026-09-29); Google's own account screen covers new and returning alike.
// Continue with Email turns into the email field in place: Google fades out above it and the
// field rises into the space (owner, 2026-09-29).
function EntryStep({ flow }: { flow: LoginFlow }) {
  const emailOpen = flow.step === 'email';
  return (
    <div>
      <FadeAway gone={emailOpen}>
        <div className='pb-3'>
          <GoogleButton next={flow.next} />
        </div>
      </FadeAway>
      {emailOpen ? (
        <EmailStep flow={flow} />
      ) : (
        <Button type='button' variant='outline' onClick={() => flow.goTo('email')} className={PRIMARY}>
          <Mail aria-hidden='true' />
          Continue with Email
        </Button>
      )}
      <InviteCodeLink />
    </div>
  );
}

// A player holding only a code has no account to sign in to yet; /join sends them back here
// with the code kept once they need one.
function InviteCodeLink() {
  return (
    <p className='pt-6 text-center text-xs text-muted-foreground tracking-wide'>
      Have an invite code?{' '}
      <Link href='/join' className='text-primary underline-offset-4 hover:underline'>
        Join a table
      </Link>
    </p>
  );
}

function ErrorLine({ error }: { error: string }) {
  if (!error) return null;
  return <p role='alert' className='text-xs text-destructive tracking-wide'>{error}</p>;
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type='button' variant='ghost' onClick={onClick} className='w-full h-11 text-xs text-muted-foreground'>
      <ArrowLeft aria-hidden='true' />
      {label}
    </Button>
  );
}

function EmailInput({ flow }: { flow: LoginFlow }) {
  return (
    <Input
      type='email'
      placeholder='Email'
      value={flow.email}
      onChange={(e) => flow.setEmail(e.target.value)}
      autoComplete='email'
      inputMode='email'
      autoCapitalize='none'
      autoCorrect='off'
      spellCheck={false}
      autoFocus
      required
      className='h-11'
    />
  );
}

function EmailStep({ flow }: { flow: LoginFlow }) {
  return (
    <form onSubmit={flow.checkEmail} className='auth-rise space-y-3'>
      <EmailInput flow={flow} />
      <ErrorLine error={flow.error} />
      <Button type='submit' className={PRIMARY} disabled={flow.busy || !flow.email.trim()}>
        <ArrowRight aria-hidden='true' />
        {flow.busy ? 'Checking…' : 'Continue'}
      </Button>
      <BackButton label='Back' onClick={() => flow.goTo('start')} />
    </form>
  );
}

function PasswordStep({ flow }: { flow: LoginFlow }) {
  return (
    <form onSubmit={flow.signIn} className='space-y-3'>
      <p className='text-sm text-center break-all'>{flow.email.trim()}</p>
      <PasswordInput
        placeholder='Password'
        value={flow.password}
        onChange={(e) => flow.setPassword(e.target.value)}
        autoComplete='current-password'
        autoFocus
        required
        className='h-11'
      />
      <ErrorLine error={flow.error} />
      <Button type='submit' className={PRIMARY} disabled={flow.busy}>
        <LogIn aria-hidden='true' />
        {flow.busy && !flow.sendingReset ? 'Signing in…' : 'Sign in'}
      </Button>
      <Button
        type='button'
        variant='ghost'
        onClick={flow.sendReset}
        disabled={flow.busy}
        className='w-full h-11 text-xs text-muted-foreground'
      >
        <KeyRound aria-hidden='true' />
        {flow.sendingReset ? 'Sending…' : 'Forgot password?'}
      </Button>
      <BackButton label='Use a different email' onClick={() => flow.goTo('email')} />
    </form>
  );
}

// Where /auth/confirm sends a reset link that was already used or has expired. The link carries
// no address, so it is asked for again.
function ResetStep({ flow }: { flow: LoginFlow }) {
  return (
    <form onSubmit={flow.sendReset} className='space-y-3'>
      <p role='alert' className='text-sm text-center'>That reset link has expired or was already used.</p>
      <p className='text-xs text-center text-muted-foreground tracking-wide'>Enter your email for a new one.</p>
      <EmailInput flow={flow} />
      <ErrorLine error={flow.error} />
      <Button type='submit' className={PRIMARY} disabled={flow.busy || !flow.email.trim()}>
        <Send aria-hidden='true' />
        {flow.sendingReset ? 'Sending…' : 'Email me a new link'}
      </Button>
      <BackButton label='Back to sign in' onClick={() => flow.goTo('start')} />
    </form>
  );
}

// The same words whether or not the address has an account, so this screen cannot be used to
// find out who has one.
function ResetSentStep({ flow }: { flow: LoginFlow }) {
  return (
    <div className='space-y-3 text-center'>
      <p className='text-xs text-muted-foreground tracking-widest uppercase'>Check your email</p>
      <p className='text-sm break-all'>{flow.email.trim()}</p>
      <p role='status' className='text-sm'>
        If this address has a Buy-In account, a link to set a new password is on its way.
      </p>
      <p className='text-xs text-muted-foreground tracking-wide'>Not there? Check spam.</p>
      <BackButton label='Back to sign in' onClick={() => flow.goTo('email')} />
    </div>
  );
}

function CreateStep({ flow }: { flow: LoginFlow }) {
  // Flagged only once the field is left, so it does not go red on every keystroke while typing.
  const [confirmLeft, setConfirmLeft] = useState(false);
  const mismatch = confirmLeft && flow.confirmPassword !== flow.password;
  return (
    <form onSubmit={flow.signUp} className='space-y-3'>
      <p className='text-sm text-center break-all'>{flow.email.trim()}</p>
      <p className='text-xs text-center text-muted-foreground tracking-wide'>New here — choose a password.</p>
      <PasswordInput
        placeholder='Password'
        value={flow.password}
        onChange={(e) => flow.setPassword(e.target.value)}
        autoComplete='new-password'
        autoFocus
        required
        className='h-11'
      />
      <PasswordInput
        placeholder='Confirm password'
        value={flow.confirmPassword}
        onChange={(e) => flow.setConfirmPassword(e.target.value)}
        onBlur={() => setConfirmLeft(true)}
        autoComplete='new-password'
        required
        aria-invalid={mismatch}
        className='h-11'
      />
      <ErrorLine error={flow.error} />
      <Button type='submit' className={PRIMARY} disabled={flow.busy}>
        <ArrowRight aria-hidden='true' />
        {flow.busy ? 'Creating account…' : 'Create account'}
      </Button>
      <BackButton label='Use a different email' onClick={() => flow.goTo('email')} />
    </form>
  );
}

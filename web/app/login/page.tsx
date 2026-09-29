'use client';

import { Suspense, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, LogIn, Mail } from 'lucide-react';

import { GoogleButton } from '@/components/auth/google-button';
import { PasswordInput } from '@/components/auth/password-input';
import { LegalLinks } from '@/components/legal/legal-links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogin, type LoginFlow } from '@/hooks/use-login';
import { cn } from '@/lib/utils';

const PRIMARY = 'w-full h-11 tracking-widest uppercase text-xs';

// useSearchParams() forces this subtree to opt out of static prerendering; Next.js
// requires a Suspense boundary around it (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const flow = useLogin();
  const confirmed = useSearchParams().get('confirmed');
  const entry = flow.step === 'start' || flow.step === 'email';

  return (
    <main className='relative min-h-dvh flex flex-col items-center justify-center px-6'>
      <div className='w-full max-w-xs'>
        <h1 className='pb-8 text-center text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
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
      </div>
      <LegalLinks className='absolute bottom-6' />
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
    </div>
  );
}

function ErrorLine({ error }: { error: string }) {
  if (!error) return null;
  return <p role='alert' className='text-xs text-destructive tracking-wide'>{error}</p>;
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type='button' variant='ghost' onClick={onClick} className='w-full text-xs text-muted-foreground'>
      <ArrowLeft aria-hidden='true' />
      {label}
    </Button>
  );
}

function EmailStep({ flow }: { flow: LoginFlow }) {
  return (
    <form onSubmit={flow.checkEmail} className='auth-rise space-y-3'>
      <Input
        type='email'
        placeholder='Email'
        value={flow.email}
        onChange={(e) => flow.setEmail(e.target.value)}
        autoComplete='email'
        autoFocus
        required
        className='h-11'
      />
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
        {flow.busy ? 'Signing in…' : 'Sign in'}
      </Button>
      <BackButton label='Use a different email' onClick={() => flow.goTo('email')} />
    </form>
  );
}

function CreateStep({ flow }: { flow: LoginFlow }) {
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
        autoComplete='new-password'
        required
        className='h-11'
      />
      <ErrorLine error={flow.error} />
      <Button type='submit' className={PRIMARY} disabled={flow.busy}>
        <ArrowRight aria-hidden='true' />
        {flow.busy ? 'Creating account…' : 'Continue'}
      </Button>
      <BackButton label='Use a different email' onClick={() => flow.goTo('email')} />
    </form>
  );
}

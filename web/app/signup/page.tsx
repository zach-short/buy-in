'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GoogleButton, OrDivider } from '@/components/auth/google-button';
import { PasswordInput } from '@/components/auth/password-input';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { useSignUp, type SignUpState } from '@/hooks/use-sign-up';

function AccountFields({ fields, setField }: Pick<SignUpState, 'fields' | 'setField'>) {
  return (
    <div className='space-y-3 min-w-0'>
      <Input
        placeholder='Name'
        value={fields.name}
        onChange={(e) => setField('name', e.target.value)}
        autoComplete='name'
        required
        className='h-11'
      />
      <Input
        type='email'
        placeholder='Email'
        value={fields.email}
        onChange={(e) => setField('email', e.target.value)}
        autoComplete='email'
        required
        className='h-11'
      />
      <PasswordInput
        placeholder='Password'
        value={fields.password}
        onChange={(e) => setField('password', e.target.value)}
        autoComplete='new-password'
        required
        className='h-11'
      />
      <PasswordInput
        placeholder='Confirm password'
        value={fields.confirmPassword}
        onChange={(e) => setField('confirmPassword', e.target.value)}
        autoComplete='new-password'
        required
        className='h-11'
      />
    </div>
  );
}

function SignUpForm({ signUp }: { signUp: SignUpState }) {
  const { fields, setField, status, submit, invited } = signUp;
  const submitting = status.kind === 'submitting';

  return (
    <form onSubmit={submit} className='space-y-3'>
      {invited && (
        <p className='text-xs text-muted-foreground tracking-wide'>
          You&apos;ve been invited to join a table. Create an account to continue.
        </p>
      )}
      <AccountFields fields={fields} setField={setField} />
      {status.kind === 'error' && <p className='text-xs text-destructive tracking-wide'>{status.message}</p>}
      <Button type='submit' className='w-full h-11 tracking-widest uppercase text-xs' disabled={submitting}>
        {submitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}

// Google sign-up lands on '/', and /auth/callback sends an account with no table or seat to
// /welcome, the same place the email form goes.
function GoogleSignUp({ signUp }: { signUp: SignUpState }) {
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get('redirect'), '/');
  return <GoogleButton next={next} disabled={signUp.status.kind === 'submitting'} />;
}

// useSearchParams() (in useSignUp, for ?redirect=) forces this subtree to opt out of
// static prerendering; Next.js requires a Suspense boundary around it
// (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpPageInner />
    </Suspense>
  );
}

function SignUpPageInner() {
  const signUp = useSignUp();

  return (
    <main className='min-h-dvh flex flex-col items-center justify-center px-6 py-12'>
      <div className='w-full max-w-xs space-y-8'>
        <div className='text-center space-y-1'>
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>New account</p>
        </div>

        <GoogleSignUp signUp={signUp} />
        <OrDivider />
        <SignUpForm signUp={signUp} />

        <p className='text-center text-xs text-muted-foreground tracking-wide'>
          Already have an account?{' '}
          <Link href='/login' className='text-primary underline-offset-4 hover:underline'>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GoogleButton, OrDivider } from '@/components/auth/google-button';
import { HostFields } from '@/components/auth/host-fields';
import { PasswordInput } from '@/components/auth/password-input';
import { RolePicker } from '@/components/auth/role-picker';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { useSignUp, type SignUpState } from '@/hooks/use-sign-up';

function AccountFields({ fields, setField, accountCreated }: Pick<SignUpState, 'fields' | 'setField' | 'accountCreated'>) {
  return (
    // Locked once the account exists: a retry after a failed create_bar only sets up the table.
    <fieldset disabled={accountCreated} className='space-y-3 min-w-0'>
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
    </fieldset>
  );
}

function SignUpForm({ signUp }: { signUp: SignUpState }) {
  const { fields, setField, status, accountCreated, submit, invited } = signUp;
  const submitting = status.kind === 'submitting';

  return (
    <form onSubmit={submit} className='space-y-3'>
      {invited ? (
        // Arriving via a ?redirect= means an invite or RSVP link sent them here — nobody
        // clicking one of those is trying to start their own table, so there is no host
        // option to pick by mistake. useSignUp already pins fields.role to 'member'.
        <p className='text-xs text-muted-foreground tracking-wide'>
          You&apos;ve been invited to join a table. Create an account to continue.
        </p>
      ) : (
        <RolePicker value={fields.role} onChange={(role) => setField('role', role)} />
      )}
      <AccountFields fields={fields} setField={setField} accountCreated={accountCreated} />
      {!invited && fields.role === 'host' && <HostFields fields={fields} setField={setField} />}
      {!invited && !fields.role && <p className='text-xs text-muted-foreground tracking-wide'>Choose one to continue.</p>}
      {status.kind === 'error' && <p className='text-xs text-destructive tracking-wide'>{status.message}</p>}
      <Button type='submit' className='w-full h-11 tracking-widest uppercase text-xs' disabled={submitting || !fields.role}>
        {submitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}

// The OAuth round trip leaves the page, so a host's table name cannot be collected first. Google
// sign-up asks no role: /auth/callback sends an account with no table or seat to /welcome, which does.
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

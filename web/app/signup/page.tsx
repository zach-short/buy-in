'use client';

import { Suspense } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSignUp, type Role, type SignUpState } from '@/hooks/use-sign-up';
import { cn } from '@/lib/utils';

const ROLES: ReadonlyArray<{ role: Role; title: string; hint: string }> = [
  { role: 'host', title: "I'm hosting a game", hint: 'Set up your table' },
  { role: 'member', title: "I'm joining a game", hint: 'Enter an invite code next' },
];

function RolePicker({ value, onChange }: { value: Role | null; onChange: (role: Role) => void }) {
  return (
    <div role='group' aria-label='Account type' className='grid grid-cols-2 gap-3'>
      {ROLES.map(({ role, title, hint }) => (
        <button
          key={role}
          type='button'
          aria-pressed={value === role}
          onClick={() => onChange(role)}
          className={cn(
            'flex flex-col items-start justify-start gap-1 rounded-md border px-3 py-4 text-left transition-colors outline-none',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            value === role ? 'border-primary bg-primary/10' : 'border-input hover:bg-accent',
          )}
        >
          <span className='block text-sm font-medium'>{title}</span>
          <span className='block text-xs text-muted-foreground'>{hint}</span>
        </button>
      ))}
    </div>
  );
}

function HostFields({ fields, setField }: Pick<SignUpState, 'fields' | 'setField'>) {
  return (
    <div className='space-y-3 pt-2'>
      <p className='text-xs text-muted-foreground tracking-widest uppercase'>Your table</p>
      <Input
        placeholder='Table name'
        value={fields.barName}
        onChange={(e) => setField('barName', e.target.value)}
        required
        className='h-11'
      />
      <Input
        placeholder='Venmo handle (optional)'
        value={fields.venmo}
        onChange={(e) => setField('venmo', e.target.value)}
        autoCapitalize='none'
        autoCorrect='off'
        className='h-11'
      />
      <Input
        placeholder='Cash App handle (optional)'
        value={fields.cashapp}
        onChange={(e) => setField('cashapp', e.target.value)}
        autoCapitalize='none'
        autoCorrect='off'
        className='h-11'
      />
    </div>
  );
}

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
      <Input
        type='password'
        placeholder='Password'
        value={fields.password}
        onChange={(e) => setField('password', e.target.value)}
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

// Unreachable while the project auto-confirms email (2026-09-28); signUp returns no session otherwise.
function ConfirmEmail({ email }: { email: string }) {
  return (
    <div className='space-y-2 text-center'>
      <p className='text-sm font-medium'>Check your email</p>
      <p className='text-xs text-muted-foreground tracking-wide'>
        We sent a confirmation link to {email.trim()}. Confirm it, then sign in.
      </p>
    </div>
  );
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
    <main className='min-h-screen flex flex-col items-center justify-center px-6 py-12'>
      <div className='w-full max-w-xs space-y-8'>
        <div className='text-center space-y-1'>
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>New account</p>
        </div>

        {signUp.status.kind === 'confirm-email' ? (
          <ConfirmEmail email={signUp.fields.email} />
        ) : (
          <SignUpForm signUp={signUp} />
        )}

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

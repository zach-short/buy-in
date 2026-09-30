'use client';

import { Suspense, type ComponentProps } from 'react';
import { ArrowLeft, ArrowRight, AtSign, Loader2, Phone, Plus, Spade, User, type LucideIcon } from 'lucide-react';

import { RolePicker } from '@/components/auth/role-picker';
import { WelcomeProgressBar } from '@/components/auth/welcome-progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFadedValue } from '@/hooks/use-faded-value';
import { useWelcome, type WelcomeFlow } from '@/hooks/use-welcome';
import { cn } from '@/lib/utils';
import { signOutToLanding } from '@/lib/supabase/sign-out';

// Matches .auth-fall's duration in globals.css.
const FADE_MS = 200;

const PRIMARY = 'relative w-full h-11 tracking-widest uppercase text-xs';

// useSearchParams() (in useWelcome, for ?next= and ?role=) forces this subtree to opt out of
// static prerendering; Next.js requires a Suspense boundary around it
// (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).
export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  );
}

function Welcome() {
  const flow = useWelcome();
  const { shown, leaving } = useFadedValue(flow.step, FADE_MS);

  return (
    <main className='min-h-dvh flex flex-col items-center justify-center px-6 py-12'>
      <div className='relative w-full max-w-sm space-y-8'>
        <div aria-hidden='true' className='pointer-events-none absolute -inset-x-16 -inset-y-10 -z-10 bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)] blur-2xl' />
        <h1 className='text-center text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
        <WelcomeProgressBar {...flow.progress} />
        <div key={shown} className={cn(leaving ? 'auth-fall pointer-events-none' : 'auth-rise', 'rounded-lg border bg-card/40 p-5 shadow-xs')}>
          {shown === 'role' && <RoleStep flow={flow} />}
          {shown === 'profile' && <ProfileStep flow={flow} />}
          {shown === 'table' && <TableStep flow={flow} />}
        </div>
        <Button type='button' variant='ghost' onClick={signOutToLanding} className='w-full text-xs text-muted-foreground'>
          Wrong account? Sign out
        </Button>
      </div>
    </main>
  );
}

function StepHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className='mb-5 space-y-1'>
      <h2 className='text-base font-medium'>{title}</h2>
      <p className='text-xs text-muted-foreground leading-relaxed'>{hint}</p>
    </div>
  );
}

function IconInput({ icon: Icon, ...props }: { icon: LucideIcon } & ComponentProps<typeof Input>) {
  return (
    <div className='relative'>
      <Icon aria-hidden='true' className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
      <Input className='h-11 pl-9' {...props} />
    </div>
  );
}

function RoleStep({ flow }: { flow: WelcomeFlow }) {
  return (
    <>
      <StepHeading title='How are you using Buy-In?' hint='Pick one. You can host your own table later.' />
      <RolePicker value={flow.role} onChange={flow.choose} />
    </>
  );
}

function ErrorLine({ error }: { error: string }) {
  if (!error) return null;
  return <p role='alert' className='text-xs text-destructive tracking-wide'>{error}</p>;
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <Button type='button' variant='ghost' size='sm' onClick={onClick} className='-ml-2 mb-3 h-7 text-xs text-muted-foreground'>
      <ArrowLeft aria-hidden='true' />
      Back
    </Button>
  );
}

// Swaps a button's icon for a spinner while it saves.
function SubmitIcon({ icon: Icon, submitting, className }: { icon: LucideIcon; submitting: boolean; className?: string }) {
  if (submitting) return <Loader2 aria-hidden='true' className={cn('animate-spin', className)} />;
  return <Icon aria-hidden='true' className={className} />;
}

function ProfileStep({ flow }: { flow: WelcomeFlow }) {
  return (
    <form onSubmit={flow.submitProfile} className='space-y-3'>
      {!flow.invited && <BackLink onClick={() => flow.goTo('role')} />}
      <StepHeading
        title='Your details'
        hint={flow.invited
          ? 'Your name shows on the table you’re joining.'
          : 'Your name shows on the table. Venmo and phone are optional. Venmo lets others pay you.'}
      />
      <IconInput
        icon={User}
        placeholder='Your name'
        value={flow.profile.name}
        onChange={(e) => flow.setName(e.target.value)}
        autoComplete='name'
        autoFocus
        required
        aria-invalid={flow.errorField === 'name'}
      />
      <IconInput
        icon={AtSign}
        placeholder='Venmo handle (optional)'
        value={flow.venmoInput}
        onChange={(e) => flow.setVenmo(e.target.value)}
        autoCapitalize='none'
        autoCorrect='off'
        aria-invalid={flow.errorField === 'venmo'}
      />
      <IconInput
        icon={Phone}
        type='tel'
        inputMode='tel'
        autoComplete='tel-national'
        placeholder='Phone number (optional)'
        value={flow.phoneInput}
        onChange={(e) => flow.setPhone(e.target.value)}
        aria-invalid={flow.errorField === 'phone'}
      />
      <ErrorLine error={flow.error} />
      <Button type='submit' className={PRIMARY} disabled={flow.submitting}>
        {flow.submitting ? 'Saving…' : 'Continue'}
        <SubmitIcon icon={ArrowRight} submitting={flow.submitting} className='absolute right-4' />
      </Button>
    </form>
  );
}

// The rest of a host's setup — drinks, default buy-in, players — is home's first-run guide.
function TableStep({ flow }: { flow: WelcomeFlow }) {
  return (
    <form onSubmit={flow.submitTable} className='space-y-3'>
      <BackLink onClick={() => flow.goTo('profile')} />
      <StepHeading title='Name your table' hint='This is what your players will see.' />
      <IconInput
        icon={Spade}
        placeholder='Table name'
        value={flow.tableName}
        onChange={(e) => flow.setTableName(e.target.value)}
        autoFocus
        required
        aria-invalid={flow.errorField === 'table'}
      />
      <ErrorLine error={flow.error} />
      <Button type='submit' className={PRIMARY} disabled={flow.submitting}>
        <SubmitIcon icon={Plus} submitting={flow.submitting} />
        {flow.submitting ? 'Creating table…' : 'Create table'}
      </Button>
    </form>
  );
}

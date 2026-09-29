'use client';

import { Suspense, type ComponentProps } from 'react';
import { ArrowLeft, ArrowRight, AtSign, Plus, Spade, User, type LucideIcon } from 'lucide-react';

import { RolePicker } from '@/components/auth/role-picker';
import { WelcomeProgressBar } from '@/components/auth/welcome-progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWelcome, type WelcomeFlow } from '@/hooks/use-welcome';

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

  return (
    <main className='min-h-dvh flex flex-col items-center justify-center px-6 py-12'>
      <div className='relative w-full max-w-sm space-y-8'>
        <div aria-hidden='true' className='pointer-events-none absolute -inset-x-16 -inset-y-10 -z-10 bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)] blur-2xl' />
        <div className='text-center space-y-1'>
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>Welcome</p>
        </div>
        <WelcomeProgressBar {...flow.progress} />
        <div key={flow.step} className='auth-rise rounded-lg border bg-card/40 p-5 shadow-xs'>
          {flow.step === 'role' && <RoleStep flow={flow} />}
          {flow.step === 'profile' && <ProfileStep flow={flow} />}
          {flow.step === 'table' && <TableStep flow={flow} />}
        </div>
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

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type='button' variant='ghost' onClick={onClick} className='w-full text-xs text-muted-foreground'>
      <ArrowLeft aria-hidden='true' />
      Back
    </Button>
  );
}

function ProfileStep({ flow }: { flow: WelcomeFlow }) {
  return (
    <form onSubmit={flow.submitProfile} className='space-y-3'>
      <StepHeading
        title='Your details'
        hint={flow.invited
          ? 'Your name shows on the table you’re joining.'
          : 'Your name shows on the table. Venmo is optional and lets others pay you.'}
      />
      <IconInput
        icon={User}
        placeholder='Your name'
        value={flow.profile.name}
        onChange={(e) => flow.setName(e.target.value)}
        autoComplete='name'
        autoFocus
        required
      />
      <IconInput
        icon={AtSign}
        placeholder='Venmo handle (optional)'
        value={flow.venmoInput}
        onChange={(e) => flow.setVenmo(e.target.value)}
        autoCapitalize='none'
        autoCorrect='off'
      />
      <ErrorLine error={flow.error} />
      <Button type='submit' className={PRIMARY} disabled={flow.submitting}>
        {flow.submitting ? 'Saving…' : 'Continue'}
        <ArrowRight aria-hidden='true' className='absolute right-4' />
      </Button>
      {!flow.invited && <BackButton onClick={() => flow.goTo('role')} />}
    </form>
  );
}

// The rest of a host's setup — drinks, default buy-in, players — is home's first-run guide.
function TableStep({ flow }: { flow: WelcomeFlow }) {
  return (
    <form onSubmit={flow.submitTable} className='space-y-3'>
      <StepHeading title='Name your table' hint='This is what your players will see.' />
      <IconInput
        icon={Spade}
        placeholder='Table name'
        value={flow.tableName}
        onChange={(e) => flow.setTableName(e.target.value)}
        autoFocus
        required
      />
      <ErrorLine error={flow.error} />
      <Button type='submit' className={PRIMARY} disabled={flow.submitting}>
        <Plus aria-hidden='true' />
        {flow.submitting ? 'Creating table…' : 'Create table'}
      </Button>
      <BackButton onClick={() => flow.goTo('profile')} />
    </form>
  );
}

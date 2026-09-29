'use client';

import { Suspense } from 'react';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';

import { RolePicker } from '@/components/auth/role-picker';
import { WelcomeProgressBar } from '@/components/auth/welcome-progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWelcome, type WelcomeFlow } from '@/hooks/use-welcome';

const PRIMARY = 'w-full h-11 tracking-widest uppercase text-xs';

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
      <div className='w-full max-w-xs space-y-8'>
        <div className='text-center space-y-1'>
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>Welcome</p>
        </div>
        <WelcomeProgressBar {...flow.progress} />
        {flow.step === 'role' && <RolePicker value={flow.role} onChange={flow.choose} />}
        {flow.step === 'profile' && <ProfileStep flow={flow} />}
        {flow.step === 'table' && <TableStep flow={flow} />}
      </div>
    </main>
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
      {flow.invited && (
        <p className='text-xs text-muted-foreground tracking-wide'>
          You&apos;ve been invited to join a table.
        </p>
      )}
      <Input
        placeholder='Your name'
        value={flow.profile.name}
        onChange={(e) => flow.setName(e.target.value)}
        autoComplete='name'
        autoFocus
        required
        className='h-11'
      />
      <Input
        placeholder='Venmo handle (optional)'
        value={flow.venmoInput}
        onChange={(e) => flow.setVenmo(e.target.value)}
        autoCapitalize='none'
        autoCorrect='off'
        className='h-11'
      />
      <ErrorLine error={flow.error} />
      <Button type='submit' className={PRIMARY} disabled={flow.submitting}>
        <ArrowRight aria-hidden='true' />
        {flow.submitting ? 'Saving…' : 'Continue'}
      </Button>
      {!flow.invited && <BackButton onClick={() => flow.goTo('role')} />}
    </form>
  );
}

// The rest of a host's setup — drinks, default buy-in, players — is home's first-run guide.
function TableStep({ flow }: { flow: WelcomeFlow }) {
  return (
    <form onSubmit={flow.submitTable} className='space-y-3'>
      <p className='text-xs text-muted-foreground tracking-widest uppercase'>Your table</p>
      <Input
        placeholder='Table name'
        value={flow.tableName}
        onChange={(e) => flow.setTableName(e.target.value)}
        autoFocus
        required
        className='h-11'
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

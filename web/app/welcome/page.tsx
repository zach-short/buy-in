'use client';

import { HostFields } from '@/components/auth/host-fields';
import { RolePicker } from '@/components/auth/role-picker';
import { Button } from '@/components/ui/button';
import { useWelcome } from '@/hooks/use-welcome';

// Where a first Google sign-in lands (see /auth/callback): the email form asks this at sign-up,
// and OAuth cannot, since the round trip leaves the page before a table name could be collected.
export default function WelcomePage() {
  const { role, bar, setField, choose, submit, submitting, error } = useWelcome();

  return (
    <main className='min-h-dvh flex flex-col items-center justify-center px-6 py-12'>
      <div className='w-full max-w-xs space-y-8'>
        <div className='text-center space-y-1'>
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>Welcome</p>
        </div>
        <form onSubmit={submit} className='space-y-3'>
          <RolePicker value={role} onChange={choose} />
          {role === 'host' && <HostFields fields={bar} setField={setField} />}
          {!role && <p className='text-xs text-muted-foreground tracking-wide'>Choose one to continue.</p>}
          {error && <p role='alert' className='text-xs text-destructive tracking-wide'>{error}</p>}
          {role === 'host' && (
            <Button type='submit' className='w-full h-11 tracking-widest uppercase text-xs' disabled={submitting}>
              {submitting ? 'Creating table…' : 'Create table'}
            </Button>
          )}
        </form>
      </div>
    </main>
  );
}

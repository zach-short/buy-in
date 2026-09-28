import type { ReactNode } from 'react';

/** The centred, login-style frame every /join screen renders inside. */
export function JoinShell({ children }: { children: ReactNode }) {
  return (
    <main className='min-h-screen flex flex-col items-center justify-center px-6'>
      <div className='w-full max-w-xs space-y-8'>
        <div className='text-center space-y-1'>
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>Join a table</p>
        </div>
        {children}
      </div>
    </main>
  );
}

/** The one-line status screen for the sign-in check and the sign-up redirect. */
export function JoinStatus({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest'>
      {children}
    </div>
  );
}

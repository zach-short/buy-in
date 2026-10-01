import Link from 'next/link';
import { redirect } from 'next/navigation';

import { EXPIRED_RESET_LOGIN_PATH } from '@/lib/supabase/password-reset';

import { ConfirmButton } from './confirm-button';
import { verifyRecovery } from './verify-recovery';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The reset email's link (supabase/templates/recovery.html; its URL is fixed, because production's
// template is pasted from it). Opening it only shows a button, because mail scanners open every
// link to check it: the token is spent by the button's POST (verify-recovery.ts), never by this
// GET. The page reads no session and shows nothing about the account, so a scanner learns nothing.
export default async function ConfirmResetPage({ searchParams }: { searchParams: SearchParams }) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  if (typeof tokenHash !== 'string' || !tokenHash || type !== 'recovery') redirect(EXPIRED_RESET_LOGIN_PATH);
  return (
    <main className='min-h-dvh flex flex-col items-center justify-center px-6 py-12'>
      <div className='w-full max-w-xs'>
        <h1 className='pb-8 text-center text-2xl font-semibold tracking-widest uppercase text-primary'>
          <Link href='/'>Buy-In</Link>
        </h1>
        {/* A real form, so the button works before the page's JavaScript loads (a 303 then). */}
        <form action={verifyRecovery} className='space-y-3'>
          <input type='hidden' name='token_hash' value={tokenHash} />
          <input type='hidden' name='next' value={typeof next === 'string' ? next : ''} />
          <p className='text-xs text-center text-muted-foreground tracking-widest uppercase'>Reset your password</p>
          <ConfirmButton />
        </form>
      </div>
    </main>
  );
}

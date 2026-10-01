'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { PasswordInput } from '@/components/auth/password-input';
import { StatusScreen } from '@/components/shared/status-screen';
import { Button } from '@/components/ui/button';
import { useResetPassword, type ResetPasswordForm } from '@/hooks/use-reset-password';
import { EXPIRED_RESET_LOGIN_PATH } from '@/lib/supabase/password-reset';

// The reset email's link lands here through /auth/confirm, signed in on the link's session. The
// proxy sends a signed-out visitor to /login before this renders (web/proxy.ts), because only a
// signed-in session can change a password.
export default function ResetPasswordPage() {
  const form = useResetPassword();
  if (form.signedOut) {
    return (
      <StatusScreen
        kind='error'
        title='Link expired'
        message='Your reset link has expired. Ask for a new one.'
        action={{ label: 'Email me a new link', href: EXPIRED_RESET_LOGIN_PATH }}
      />
    );
  }
  return (
    <main className='min-h-dvh flex flex-col items-center justify-center px-6 py-12'>
      <div className='w-full max-w-xs'>
        <h1 className='pb-8 text-center text-2xl font-semibold tracking-widest uppercase text-primary'>
          <Link href='/'>Buy-In</Link>
        </h1>
        <NewPasswordForm form={form} />
      </div>
    </main>
  );
}

// The sign-up pair on /login (CreateStep): the mismatch shows once the confirm field is left, so
// it does not go red on every keystroke while typing.
function NewPasswordForm({ form }: { form: ResetPasswordForm }) {
  const [confirmLeft, setConfirmLeft] = useState(false);
  const mismatch = confirmLeft && form.confirmPassword !== form.password;
  return (
    <form onSubmit={form.save} className='space-y-3'>
      <p className='text-xs text-center text-muted-foreground tracking-widest uppercase'>Set a new password</p>
      <PasswordInput
        placeholder='New password'
        value={form.password}
        onChange={(e) => form.setPassword(e.target.value)}
        autoComplete='new-password'
        autoFocus
        required
        className='h-11'
      />
      <PasswordInput
        placeholder='Confirm new password'
        value={form.confirmPassword}
        onChange={(e) => form.setConfirmPassword(e.target.value)}
        onBlur={() => setConfirmLeft(true)}
        autoComplete='new-password'
        required
        aria-invalid={mismatch}
        className='h-11'
      />
      {form.error && <p role='alert' className='text-xs text-destructive tracking-wide'>{form.error}</p>}
      <Button type='submit' className='w-full h-11 tracking-widest uppercase text-xs' disabled={form.busy}>
        <Check aria-hidden='true' />
        {form.busy ? 'Saving…' : 'Save password'}
      </Button>
    </form>
  );
}

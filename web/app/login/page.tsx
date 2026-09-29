'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { emailHasAccount } from '@/lib/supabase/email-lookup';
import { completePendingBar } from '@/lib/supabase/pending-bar';
import { GoogleButton, OrDivider } from '@/components/auth/google-button';
import { PasswordInput } from '@/components/auth/password-input';
import { safeRedirectPath } from '@/lib/safe-redirect';

// useSearchParams() forces this subtree to opt out of static prerendering; Next.js
// requires a Suspense boundary around it (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // No account for this address: hand off to the onboarding form with the email carried over.
  function startOnboarding() {
    const params = new URLSearchParams({ email: email.trim() });
    if (redirect) params.set('redirect', redirect);
    router.replace(`/signup?${params}`);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (await emailHasAccount(email)) setStep('password');
      else return startOnboarding();
    } catch (err) {
      setError(messageOf(err));
    }
    setLoading(false);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (!signInError) {
      // A host who confirmed their email on another device has no table yet; see pending-bar.ts.
      await completePendingBar(supabase).catch(() => undefined);
      return router.replace(safeRedirectPath(redirect, '/'));
    }
    // A Google-only account has no password, so it lands here too.
    setError('Wrong password. If you signed up with Google, use the Google button.');
    setLoading(false);
  }

  return (
    <main className='min-h-dvh flex flex-col items-center justify-center px-6'>
      <div className='w-full max-w-xs space-y-8'>
        <h1 className='text-center text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
        {searchParams.get('confirmed') && (
          <p className='text-center text-xs text-muted-foreground tracking-wide'>
            Your email is confirmed. Sign in to continue.
          </p>
        )}

        {step === 'email' ? (
          <div className='space-y-3'>
            <form onSubmit={handleEmail} className='space-y-3'>
              <Input
                type='email'
                placeholder='Email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete='email'
                autoFocus
                required
                className='h-11'
              />
              {error && <p className='text-xs text-destructive tracking-wide'>{error}</p>}
              <Button type='submit' className='w-full h-11 tracking-widest uppercase text-xs' disabled={loading || !email.trim()}>
                {loading ? 'Checking…' : 'Continue'}
              </Button>
            </form>
            <OrDivider />
            <GoogleButton next={safeRedirectPath(redirect, '/')} />
          </div>
        ) : (
          <form onSubmit={handlePassword} className='space-y-3'>
            <p className='text-sm text-center break-all'>{email.trim()}</p>
            <PasswordInput
              placeholder='Password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete='current-password'
              autoFocus
              required
              className='h-11'
            />
            {error && <p className='text-xs text-destructive tracking-wide'>{error}</p>}
            <Button type='submit' className='w-full h-11 tracking-widest uppercase text-xs' disabled={loading}>
              {loading ? 'Signing in…' : 'Enter'}
            </Button>
            <Button
              type='button'
              variant='ghost'
              onClick={() => { setStep('email'); setPassword(''); setError(''); }}
              className='w-full text-xs text-muted-foreground'
            >
              Use a different email
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

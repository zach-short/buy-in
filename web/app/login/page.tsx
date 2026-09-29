'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { GoogleButton } from '@/components/auth/google-button';
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      router.replace(safeRedirectPath(searchParams.get('redirect'), '/'));
    } else {
      setError('Invalid credentials.');
    }
    setLoading(false);
  }

  return (
    <main className='min-h-screen flex flex-col items-center justify-center px-6'>
      <div className='w-full max-w-xs space-y-8'>
        <h1 className='text-center text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>

        <div className='space-y-3'>
          {showEmail ? (
            <form onSubmit={handleSubmit} className='space-y-3'>
              <Input
                type='email'
                placeholder='Email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete='email'
                autoFocus
                className='h-11'
              />
              <Input
                type='password'
                placeholder='Password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete='current-password'
                className='h-11'
              />
              {error && <p className='text-xs text-destructive tracking-wide'>{error}</p>}
              <Button type='submit' className='w-full h-11 tracking-widest uppercase text-xs' disabled={loading}>
                {loading ? 'Signing in…' : 'Enter'}
              </Button>
            </form>
          ) : (
            <Button
              type='button'
              variant='outline'
              onClick={() => setShowEmail(true)}
              className='w-full h-11 tracking-widest uppercase text-xs'
            >
              Continue with Email
            </Button>
          )}
          <GoogleButton next={safeRedirectPath(searchParams.get('redirect'), '/')} />
        </div>

        <p className='text-center text-xs text-muted-foreground tracking-wide'>
          Don&apos;t have an account?{' '}
          <Link
            href={
              searchParams.get('redirect')
                ? `/signup?redirect=${encodeURIComponent(searchParams.get('redirect')!)}`
                : '/signup'
            }
            className='text-primary underline-offset-4 hover:underline'
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

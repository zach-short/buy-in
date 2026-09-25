'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // DESIGN.md D5: Supabase Auth, email and password only — no OAuth provider on the web.
    const { error: signInError } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      router.replace('/');
    } else {
      setError('Invalid credentials.');
    }
    setLoading(false);
  }

  return (
    <main className='min-h-screen flex flex-col items-center justify-center px-6'>
      <div className='w-full max-w-xs space-y-8'>
        <div className='text-center space-y-1'>
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>Members only</p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-3'>
          <Input
            type='email'
            placeholder='Email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete='email'
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
      </div>
    </main>
  );
}

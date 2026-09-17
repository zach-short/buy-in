'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', { name, password, redirect: false });

    if (res?.ok) {
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
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Poker Bar</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>Members only</p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-3'>
          <Input
            placeholder='Name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete='username'
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

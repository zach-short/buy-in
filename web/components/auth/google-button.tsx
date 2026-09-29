'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/lib/supabase/oauth';

export function GoogleButton({ next, disabled = false }: { next: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setLoading(false);
    }
  }

  return (
    <div className='space-y-2'>
      <Button
        type='button'
        variant='outline'
        onClick={handleClick}
        disabled={disabled || loading}
        className='w-full h-11 tracking-widest uppercase text-xs'
      >
        {loading ? 'Redirecting…' : 'Continue with Google'}
      </Button>
      {error && <p className='text-xs text-destructive tracking-wide'>{error}</p>}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className='flex items-center gap-3 text-xs text-muted-foreground tracking-widest uppercase'>
      <span className='h-px flex-1 bg-border' />
      or
      <span className='h-px flex-1 bg-border' />
    </div>
  );
}

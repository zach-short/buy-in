'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/lib/supabase/oauth';

// Google's "G", drawn inline because lucide has no brand icons. Its four segments are four
// shades of the app's gold (--primary mixed toward white or black) rather than Google's own
// colours (owner, 2026-09-29), so it retints with the token.
const GOLD = {
  light: 'color-mix(in oklch, var(--primary) 65%, white)',
  base: 'var(--primary)',
  deep: 'color-mix(in oklch, var(--primary) 75%, black)',
  deepest: 'color-mix(in oklch, var(--primary) 55%, black)',
};

function GoogleLogo() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
      <path style={{ fill: GOLD.light }} d='M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z' />
      <path style={{ fill: GOLD.deep }} d='M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z' />
      <path style={{ fill: GOLD.deepest }} d='M5.28 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l4.01-3.1Z' />
      <path style={{ fill: GOLD.base }} d='M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z' />
    </svg>
  );
}

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
        <GoogleLogo />
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

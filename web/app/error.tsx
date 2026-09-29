'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { StatusScreen } from '@/components/shared/status-screen';

// Next 16.3 hands the boundary both `retry` (refetch + re-render, what the docs recommend) and
// `reset` (re-render without refetching); a failed server fetch is the common case here, so retry.
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <StatusScreen
        kind='error'
        title='Something went wrong'
        message='Try again, or head back home.'
        action={{ label: 'Retry', onClick: retry }}
      />
      <HomeLink />
    </>
  );
}

function HomeLink() {
  return (
    <Link
      href='/'
      className='fixed inset-x-0 bottom-10 text-center text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
    >
      Home
    </Link>
  );
}

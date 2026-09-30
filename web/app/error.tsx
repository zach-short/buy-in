'use client';

import { useEffect } from 'react';

import { StatusScreen } from '@/components/shared/status-screen';

// Next 16.3 hands the boundary both `retry` (refetch + re-render, what the docs recommend) and
// `reset` (re-render without refetching); a failed server fetch is the common case here, so retry.
// Home sits inside the status screen, not pinned to the bottom edge: the bottom nav (z-40) paints
// over anything fixed there, which left only Retry visible on nav routes.
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      kind='error'
      title='Something went wrong'
      message='Try again, or head back home.'
      action={{ label: 'Retry', onClick: retry }}
      secondaryAction={{ label: 'Home', href: '/' }}
    />
  );
}

'use client';

import './globals.css';

import { useEffect } from 'react';

import { StatusScreen } from '@/components/shared/status-screen';

// Replaces the root layout when it throws, so it needs its own document and stylesheet. The
// app is dark-only (forcedTheme in layout.tsx), so the class is fixed rather than themed.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang='en' className='dark'>
      <body>
        <StatusScreen kind='error' title='Something went wrong' action={{ label: 'Retry', onClick: retry }} />
      </body>
    </html>
  );
}

'use client';

import { useRouter } from 'next/navigation';

// An installed PWA has no browser chrome, so a Back that pops history past the first entry
// (a page opened from a link, or a cold launch) would do nothing or leave the app.
export function useGoBack(fallback: string): () => void {
  const router = useRouter();
  return () => (window.history.length > 1 ? router.back() : router.push(fallback));
}

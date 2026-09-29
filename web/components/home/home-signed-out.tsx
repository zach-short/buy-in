'use client';

import { Landing } from '@/components/landing/landing';
import { useRefreshOnAuthChange } from '@/components/home/use-refresh-on-auth-change';

// Landing plus the listener that moves a visitor to Home when they sign in in another tab.
export function HomeSignedOut() {
  useRefreshOnAuthChange(false);
  return <Landing />;
}

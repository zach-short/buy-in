import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { joinMetadata } from '@/lib/invite-metadata';
import { fetchInvitePreview } from '@/lib/supabase/public-server';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return joinMetadata(await fetchInvitePreview(token));
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

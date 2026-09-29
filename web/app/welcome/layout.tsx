import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Welcome',
  description: 'Choose whether you are hosting a poker night or joining a table.',
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: "Sign up",
  description:
    "Create a Buy-In account to host a poker night or join your table.",
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

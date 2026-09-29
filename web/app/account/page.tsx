'use client';

import Link from 'next/link';

import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { InstallCard } from '@/components/shared/install-card';
import { SignoutButton } from '@/components/shared/button/signout';
import { useAuthUser } from '@/hooks/use-auth-user';

const MORE_LINKS = [
  { label: 'Settings', href: '/account/settings' },
  { label: 'Invites', href: '/invites' },
  { label: 'Stats', href: '/stats' },
  { label: 'Performance', href: '/performance' },
  { label: 'Inventory', href: '/inventory' },
  { label: 'Drinks', href: '/drinks' },
  { label: 'Menu', href: '/menu' },
] as const;

function SectionLabel({ children }: { children: string }) {
  return <p className='text-xs tracking-widest uppercase text-muted-foreground mb-3'>{children}</p>;
}

export default function AccountPage() {
  const { user } = useAuthUser();

  return (
    <PageMain>
      <PageHeader title='Account' subtitle={user?.email} />

      <InstallCard />

      <SectionLabel>More</SectionLabel>
      <nav className='flex flex-col border-t border-border mb-10'>
        {MORE_LINKS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className='flex items-center justify-between py-4 border-b border-border text-sm tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
          >
            {label}
            <span className='text-primary text-xs'>›</span>
          </Link>
        ))}
      </nav>

      <SignoutButton className='mt-4' />
    </PageMain>
  );
}

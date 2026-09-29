'use client';

import Link from 'next/link';

import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { InstallCard } from '@/components/shared/install-card';
import { MyTables } from '@/components/shared/my-tables';
import { SignoutButton } from '@/components/shared/button/signout';
import { useAuthUser } from '@/hooks/use-auth-user';
import { useIsBarStaff } from '@/hooks/use-is-bar-staff';

const MORE_LINKS = [
  { label: 'Settings', href: '/account/settings' },
  { label: 'Invites', href: '/invites' },
  { label: 'Results', href: '/results' },
  { label: 'Inventory', href: '/inventory' },
  { label: 'Drinks', href: '/drinks' },
  { label: 'Menu', href: '/menu' },
] as const;

export default function AccountPage() {
  const { user } = useAuthUser();
  const isHost = useIsBarStaff();

  return (
    <PageMain>
      <PageHeader title='Account' subtitle={user?.email} />

      <InstallCard />

      <MyTables />

      {isHost === false && (
        <Link
          href='/welcome'
          className='flex items-center justify-between py-4 mb-10 border-y border-border text-sm tracking-widest uppercase hover:text-primary transition-colors'
        >
          Host your own table
          <span className='text-primary text-xs'>›</span>
        </Link>
      )}

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

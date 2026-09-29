'use client';

import Link from 'next/link';

import { InstallCard } from '@/components/shared/install-card';
import { DefaultBuyInSetting } from '@/components/shared/default-buy-in-setting';
import { SignoutButton } from '@/components/shared/button/signout';
import { VenmoNoteSetting } from '@/components/shared/venmo-note-setting';
import { useAuthUser } from '@/hooks/use-auth-user';

const MORE_LINKS = [
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
    <main className='min-h-screen px-6 py-10 max-w-sm mx-auto'>
      <div className='mb-10'>
        <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Account</h1>
        {user?.email && <p className='text-xs text-muted-foreground mt-0.5'>{user.email}</p>}
      </div>

      <InstallCard />

      <SectionLabel>Bar tools</SectionLabel>
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

      <SectionLabel>Settings</SectionLabel>
      <VenmoNoteSetting />
      <DefaultBuyInSetting />

      <SignoutButton className='mt-4' />
    </main>
  );
}

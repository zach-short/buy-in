'use client';

import Link from 'next/link';

import type { FeatureVisibility } from '@pb/core';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { InstallCard } from '@/components/shared/install-card';
import { MyTables } from '@/components/shared/my-tables';
import { SignoutButton } from '@/components/shared/button/signout';
import { useAuthUser } from '@/hooks/use-auth-user';
import { useBarFeatures } from '@/hooks/use-bar-features';
import { useIsBarStaff } from '@/hooks/use-is-bar-staff';

// A link with a `feature` shows only while that drinks-side feature is on (host-setup P2).
// Results stays: its poker tab has nothing to do with drinks.
// A `hostOnly` link shows only to an owner or host (member-home O2): a member reaches Results
// from their own nav, and the rest are the bar's screens.
type MoreLink = { label: string; href: string; feature?: keyof FeatureVisibility; hostOnly?: true };
const MORE_LINKS: readonly MoreLink[] = [
  { label: 'Settings', href: '/account/settings' },
  { label: 'Invites', href: '/invites', hostOnly: true },
  { label: 'Results', href: '/results', hostOnly: true },
  { label: 'Inventory', href: '/inventory', feature: 'inventory', hostOnly: true },
  { label: 'Drinks', href: '/drinks', feature: 'drinks', hostOnly: true },
  { label: 'Menu', href: '/menu', feature: 'menu', hostOnly: true },
];

// Until the staff read returns, host links stay hidden: a member must never see them flash.
function showsLink(link: MoreLink, isHost: boolean | undefined, visible: FeatureVisibility): boolean {
  if (link.hostOnly && isHost !== true) return false;
  return !link.feature || visible[link.feature];
}

export default function AccountPage() {
  const { user } = useAuthUser();
  const isHost = useIsBarStaff();
  const { visible } = useBarFeatures();

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
        {MORE_LINKS.filter((link) => showsLink(link, isHost, visible)).map(({ label, href }) => (
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

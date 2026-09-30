'use client';

import { BookOpen, Home, Mail, Package, Settings, Trophy, Wine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { FeatureVisibility } from '@pb/core';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { LinkRow } from '@/components/shared/link-row';
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
type MoreLink = { label: string; href: string; icon: LucideIcon; feature?: keyof FeatureVisibility; hostOnly?: true };
const MORE_LINKS: readonly MoreLink[] = [
  { label: 'Settings', icon: Settings, href: '/account/settings' },
  { label: 'Invites', icon: Mail, href: '/invites', hostOnly: true },
  { label: 'Results', icon: Trophy, href: '/results', hostOnly: true },
  { label: 'Inventory', icon: Package, href: '/inventory', feature: 'inventory', hostOnly: true },
  { label: 'Drinks', icon: Wine, href: '/drinks', feature: 'drinks', hostOnly: true },
  { label: 'Menu', icon: BookOpen, href: '/menu', feature: 'menu', hostOnly: true },
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

      {/* The links lead: a host in a browser came here for Invites, Inventory or Drinks, and the
          install card and table list below them would push those off a phone's first screen. */}
      <nav aria-label='More' className='flex flex-col gap-2 mb-10'>
        {MORE_LINKS.filter((link) => showsLink(link, isHost, visible)).map(({ label, href, icon }) => (
          <LinkRow key={href} href={href} label={label} icon={icon} />
        ))}
      </nav>

      {isHost === false && (
        <div className='mb-10'>
          <LinkRow href='/welcome?role=host' label='Host your own table' icon={Home} variant='default' />
        </div>
      )}

      <InstallCard />

      <MyTables />

      <SignoutButton />
    </PageMain>
  );
}

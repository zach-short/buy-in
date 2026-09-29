import { CalendarDays, CircleUser, History, House, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Path prefixes that keep this tab lit — the secondary pages live under Account. */
  owns: readonly string[];
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', href: '/', icon: House, owns: [] },
  { label: 'Sessions', href: '/sessions', icon: History, owns: ['/sessions'] },
  { label: 'Schedule', href: '/schedule', icon: CalendarDays, owns: ['/schedule'] },
  { label: 'Players', href: '/players', icon: Users, owns: ['/players'] },
  {
    label: 'Account',
    href: '/account',
    icon: CircleUser,
    owns: ['/account', '/invites', '/stats', '/performance', '/inventory', '/drinks', '/menu'],
  },
];

// /session/* (singular) is the live table and stays full-screen, so it is deliberately absent.
export function showsNav(pathname: string): boolean {
  return NAV_ITEMS.some((item) => isActive(item, pathname));
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/';
  return item.owns.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

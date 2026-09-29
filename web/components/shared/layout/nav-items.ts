import { CalendarDays, ChartLine, CircleUser, History, House, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Path prefixes that keep this tab lit — the secondary pages live under Account. */
  owns: readonly string[];
};

const HOME: NavItem = { label: 'Home', href: '/', icon: House, owns: [] };

export const NAV_ITEMS: readonly NavItem[] = [
  HOME,
  { label: 'Sessions', href: '/sessions', icon: History, owns: ['/sessions'] },
  { label: 'Schedule', href: '/schedule', icon: CalendarDays, owns: ['/schedule'] },
  { label: 'Players', href: '/players', icon: Users, owns: ['/players'] },
  {
    label: 'Account',
    href: '/account',
    icon: CircleUser,
    owns: ['/account', '/invites', '/results', '/inventory', '/drinks', '/menu'],
  },
];

// A player who hosts nowhere (member-home SCOPE.md §7 O2): every tab has data they may read.
// Results is the old Performance tab — /performance redirects to its poker tab (B11).
export const MEMBER_NAV_ITEMS: readonly NavItem[] = [
  HOME,
  { label: 'Results', href: '/results', icon: ChartLine, owns: ['/results'] },
  { label: 'Account', href: '/account', icon: CircleUser, owns: ['/account'] },
];

// Screens that read a bar's own rows, which a member has none of: fetchBarId and
// fetchBarSettings throw for them (SCOPE.md §1 row 9). Display only — RLS is the wall (H2).
// /menu/<bar id> is the public drinks board, so only the /menu index is here; /results is
// shared, and its bar tab guards itself.
const HOST_ONLY_PREFIXES = ['/sessions', '/session', '/schedule', '/players', '/invites', '/inventory', '/drinks'];

export function isHostOnly(pathname: string): boolean {
  if (pathname === '/menu') return true;
  return HOST_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// /session/* (singular) is the live table and stays full-screen, so it is deliberately absent.
// NAV_ITEMS owns every path MEMBER_NAV_ITEMS does, so one list answers for both shells.
export function showsNav(pathname: string): boolean {
  return NAV_ITEMS.some((item) => isActive(item, pathname));
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/';
  return item.owns.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

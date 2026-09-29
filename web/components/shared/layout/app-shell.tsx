'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { HostOnly } from '@/components/shared/host-only';
import { useAuthUser } from '@/hooks/use-auth-user';
import { useIsBarStaff } from '@/hooks/use-is-bar-staff';
import { cn } from '@/lib/utils';
import { MEMBER_NAV_ITEMS, NAV_ITEMS, type NavItem, isActive, isHostOnly, showsNav } from './nav-items';

// Literal classes, so Tailwind sees both.
const GRID_COLS: Record<number, string> = { 3: 'grid-cols-3', 5: 'grid-cols-5' };

function DesktopLinks({ items, pathname }: { items: readonly NavItem[]; pathname: string }) {
  return (
    <div className='hidden md:flex items-center gap-8'>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item, pathname) ? 'page' : undefined}
          className={cn(
            'text-xs tracking-widest uppercase transition-colors',
            isActive(item, pathname) ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function TopBar({ items, pathname }: { items: readonly NavItem[]; pathname: string }) {
  return (
    <header className='hidden md:block fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-background/90 backdrop-blur'>
      <div className='mx-auto flex h-full max-w-3xl items-center justify-between px-6'>
        <Link href='/' className='font-display text-sm font-semibold tracking-widest uppercase text-primary'>
          Buy-In
        </Link>
        <DesktopLinks items={items} pathname={pathname} />
      </div>
    </header>
  );
}

function BottomBar({ items, pathname }: { items: readonly NavItem[]; pathname: string }) {
  return (
    <nav
      aria-label='Primary'
      className='md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-(--nav-inset)'
    >
      <ul className={cn('grid', GRID_COLS[items.length])}>
        {items.map((item) => {
          const active = isActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-1 text-[10px] tracking-widest uppercase transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// The desktop bar is a <header> and the phone bar is a <nav>, so only one is exposed to a screen
// reader at a time; both are hidden by CSS, not unmounted, to avoid a hydration flash on resize.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status } = useAuthUser();
  const isStaff = useIsBarStaff();
  const shown = showsNav(pathname) && status !== 'unauthenticated';
  // H1: until the staff read returns, neither nav — a member must never see the host's.
  const items = isStaff === undefined ? null : isStaff ? NAV_ITEMS : MEMBER_NAV_ITEMS;

  return (
    <div
      className={cn(
        // The installed PWA draws under a translucent status bar (viewportFit cover), so the
        // shell starts below it. Pages size themselves with min-h-dvh; with the shell's padding
        // that would always overflow, so their minimum is dropped and they flex to fill instead.
        'flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] *:min-h-0! *:flex-1',
        shown && 'pb-[calc(3.5rem+var(--nav-inset))] md:pb-0 md:pt-14',
      )}
    >
      {/* Masks content scrolling up under the clock and battery. */}
      <div aria-hidden className='fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)] bg-background' />
      <Guarded pathname={pathname} signedIn={status !== 'unauthenticated'} isStaff={isStaff}>
        {children}
      </Guarded>
      {shown && status === 'authenticated' && items && (
        <>
          <TopBar items={items} pathname={pathname} />
          <BottomBar items={items} pathname={pathname} />
        </>
      )}
    </div>
  );
}

// H3: a host-only screen must not mount for a member — its fetchBarId would throw before any
// guard inside it ran — so it waits for the staff read. Signed out, the proxy has already sent
// the visitor to /login, and nothing here stands in its way.
function Guarded({ pathname, signedIn, isStaff, children }: {
  pathname: string;
  signedIn: boolean;
  isStaff: boolean | undefined;
  children: ReactNode;
}) {
  if (!signedIn || !isHostOnly(pathname)) return children;
  if (isStaff === undefined) return null;
  return isStaff ? children : <HostOnly />;
}

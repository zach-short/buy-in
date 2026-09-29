'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuthUser } from '@/hooks/use-auth-user';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isActive, showsNav } from './nav-items';

function DesktopLinks({ pathname }: { pathname: string }) {
  return (
    <div className='hidden md:flex items-center gap-8'>
      {NAV_ITEMS.map((item) => (
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

function TopBar({ pathname }: { pathname: string }) {
  return (
    <header className='hidden md:block fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-background/90 backdrop-blur'>
      <div className='mx-auto flex h-full max-w-3xl items-center justify-between px-6'>
        <Link href='/' className='text-sm font-semibold tracking-widest uppercase text-primary'>
          Buy-In
        </Link>
        <DesktopLinks pathname={pathname} />
      </div>
    </header>
  );
}

function BottomBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label='Primary'
      className='md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]'
    >
      <ul className='grid grid-cols-5'>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[10px] tracking-widest uppercase transition-colors',
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
  const shown = showsNav(pathname) && status !== 'unauthenticated';

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col',
        // Pages size themselves with min-h-dvh; with the bar's padding that would always
        // overflow by the bar's height, so their minimum is dropped and they flex to fill instead.
        shown && 'pb-16 md:pb-0 md:pt-14 *:min-h-0! *:flex-1',
      )}
    >
      {children}
      {shown && status === 'authenticated' && (
        <>
          <TopBar pathname={pathname} />
          <BottomBar pathname={pathname} />
        </>
      )}
    </div>
  );
}

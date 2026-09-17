'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  User,
  Settings,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignoutButton } from '../button/signout';
import { ThemeToggle } from '../button/theme-toggle';
import { cn } from '@/lib/utils';

const menuItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Profile', href: '/profile', icon: User },
  { title: 'Settings', href: '/settings', icon: Settings },
];

function ProfileCard() {
  const session = useSession();
  const sessionUser = session.data?.user;

  const displayName = sessionUser?.name;
  const displayEmail = sessionUser?.email;
  const displayPicture = sessionUser?.image;

  return (
    <div className={`flex flex-row items-center justify-between`}>
      <div className='flex items-center gap-3'>
        <Avatar>
          <AvatarImage src={displayPicture || undefined} />
          <AvatarFallback>
            {displayName?.substring(0, 2).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className={`flex flex-col items-start`}>
          <p className='font-medium'>{displayName || 'User'}</p>
          <p className={`text-xs text-muted-foreground`}>{displayEmail}</p>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}

function MenuItem({
  href,
  title,
  icon: Icon,
  onClick,
  isActive = false,
}: {
  href: string;
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  onClick?: () => void;
  isActive?: boolean;
}) {
  return (
    <Link
      className={cn(
        'py-1 flex items-center gap-3 relative transition-colors rounded-md px-2 py-2',
        isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
      )}
      href={href}
      onClick={onClick}
    >
      <div className='relative'>
        <Icon size={20} />
      </div>
      {title}
    </Link>
  );
}

interface MenuContentProps {
  onItemClick?: () => void;
  className?: string;
}

export function MenuContent({ onItemClick, className = '' }: MenuContentProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <ProfileCard />
      <div className='flex flex-col overflow-y-auto mt-4 flex-1 gap-1'>
        {menuItems.map((menuItem) => (
          <MenuItem
            title={menuItem.title}
            key={menuItem.href}
            href={menuItem.href}
            icon={menuItem.icon}
            onClick={onItemClick}
            isActive={isActive(menuItem.href)}
          />
        ))}
      </div>
      <SignoutButton className={`mt-4`} />
    </div>
  );
}

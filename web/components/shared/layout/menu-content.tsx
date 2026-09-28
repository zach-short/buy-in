'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  User,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignoutButton } from '../button/signout';
import { ThemeToggle } from '../button/theme-toggle';
import { cn } from '@/lib/utils';
import { useAuthUser } from '@/hooks/use-auth-user';

const menuItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Performance', href: '/performance', icon: TrendingUp },
  { title: 'Profile', href: '/profile', icon: User },
  { title: 'Settings', href: '/settings', icon: Settings },
];

function ProfileCard() {
  const { user } = useAuthUser();

  // Supabase email-and-password users (D5) carry no display name or picture — NextAuth's were
  // hardcoded in web/lib/auth.ts — and user_metadata is untyped and user-editable, so the card
  // shows the fallbacks it always had for a missing name and picture.
  return (
    <div className={`flex flex-row items-center justify-between`}>
      <div className='flex items-center gap-3'>
        <Avatar>
          <AvatarImage src={undefined} />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
        <div className={`flex flex-col items-start`}>
          <p className='font-medium'>User</p>
          <p className={`text-xs text-muted-foreground`}>{user?.email}</p>
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

import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { signOutToLanding } from '@/lib/supabase/sign-out';

export function SignoutButton({ className }: { className?: string }) {
  return (
    <Button
      onClick={signOutToLanding}
      className={`w-full mx-auto ${className}`}
      variant='outline'
    >
      <LogOut aria-hidden='true' />
      Sign out
    </Button>
  );
}

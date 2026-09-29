import { ChevronRight, Spade, Ticket, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

export type Role = 'host' | 'member';

const ROLES: ReadonlyArray<{ role: Role; title: string; hint: string; Icon: LucideIcon }> = [
  { role: 'host', title: "I'm hosting a game", hint: 'Set up your table', Icon: Spade },
  { role: 'member', title: "I'm joining a game", hint: 'Enter an invite code next', Icon: Ticket },
];

// The outline button, not a hand-rolled card, so the hover is the login buttons' own: the gold
// border and inner glow in dark, the accent fill in light.
export function RolePicker({ value, onChange }: { value: Role | null; onChange: (role: Role) => void }) {
  return (
    <div role='group' aria-label='Account type' className='space-y-3'>
      {ROLES.map(({ role, title, hint, Icon }) => (
        <Button
          key={role}
          type='button'
          variant='outline'
          aria-pressed={value === role}
          onClick={() => onChange(role)}
          className='h-auto w-full justify-start gap-4 px-4 py-4 text-left whitespace-normal aria-pressed:border-primary'
        >
          <Icon aria-hidden='true' className='size-5 text-primary' />
          <span className='flex flex-1 flex-col gap-1'>
            <span className='text-sm font-medium'>{title}</span>
            <span className='text-xs font-normal text-muted-foreground'>{hint}</span>
          </span>
          <ChevronRight aria-hidden='true' className='text-muted-foreground' />
        </Button>
      ))}
    </div>
  );
}

import { cn } from '@/lib/utils';

export type Role = 'host' | 'member';

const ROLES: ReadonlyArray<{ role: Role; title: string; hint: string }> = [
  { role: 'host', title: "I'm hosting a game", hint: 'Set up your table' },
  { role: 'member', title: "I'm joining a game", hint: 'Enter an invite code next' },
];

export function RolePicker({ value, onChange }: { value: Role | null; onChange: (role: Role) => void }) {
  return (
    <div role='group' aria-label='Account type' className='grid grid-cols-2 gap-3'>
      {ROLES.map(({ role, title, hint }) => (
        <button
          key={role}
          type='button'
          aria-pressed={value === role}
          onClick={() => onChange(role)}
          className={cn(
            'flex flex-col items-start justify-start gap-1 rounded-md border px-3 py-4 text-left transition-colors outline-none',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            value === role ? 'border-primary bg-primary/10' : 'border-input hover:bg-accent',
          )}
        >
          <span className='block text-sm font-medium'>{title}</span>
          <span className='block text-xs text-muted-foreground'>{hint}</span>
        </button>
      ))}
    </div>
  );
}

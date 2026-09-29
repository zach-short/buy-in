import { cn } from '@/lib/utils';

export type WelcomeProgress = { steps: ReadonlyArray<'role' | 'profile' | 'table'>; current: number };

const LABELS = { role: 'Role', profile: 'You', table: 'Table' } as const;

export function WelcomeProgressBar({ steps, current }: WelcomeProgress) {
  return (
    <ol
      aria-label={`Setup progress, step ${current + 1} of ${steps.length}`}
      className='grid gap-2'
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, i) => (
        <li key={step} aria-current={i === current ? 'step' : undefined} className='space-y-2'>
          <div className='h-1 overflow-hidden rounded-full bg-border'>
            <div
              className={cn(
                'h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none',
                i <= current ? 'w-full' : 'w-0',
              )}
            />
          </div>
          <span
            className={cn(
              'block text-[10px] uppercase tracking-widest transition-colors',
              i <= current ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {LABELS[step]}
          </span>
        </li>
      ))}
    </ol>
  );
}

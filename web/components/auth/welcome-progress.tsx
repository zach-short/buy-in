export type WelcomeProgress = { current: number; total: number };

export function WelcomeProgressBar({ current, total }: WelcomeProgress) {
  return (
    <div className='space-y-2'>
      <div
        role='progressbar'
        aria-label='Setup progress'
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        className='h-1 overflow-hidden rounded-full bg-border'
      >
        <div
          className='h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none'
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
      <p className='text-right text-[10px] uppercase tracking-widest text-muted-foreground'>
        Step {current} of {total}
      </p>
    </div>
  );
}

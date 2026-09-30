import { cn } from '@/lib/utils';

interface Choice<Value> {
  value: Value;
  label: string;
}

interface ChoiceRowProps<Value> {
  label: string;
  choices: readonly Choice<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /**
   * Five short choices at phone width. Each button is at least as wide as its label, so "24 hours"
   * stays on one line; below about 350px the row wraps rather than breaking a label.
   */
  compact?: boolean;
}

/** A row of mutually exclusive buttons, in the house aria-pressed style (pot-decision.tsx). */
export function ChoiceRow<Value extends string | number>({ label, choices, value, onChange, compact = false }: ChoiceRowProps<Value>) {
  return (
    <div role='group' aria-label={label} className={cn('flex', compact ? 'flex-wrap gap-1.5' : 'gap-2')}>
      {choices.map((choice) => {
        const chosen = choice.value === value;
        return (
          <button
            key={choice.value}
            type='button'
            aria-pressed={chosen}
            onClick={() => onChange(choice.value)}
            className={cn(
              'flex-1 min-w-0 h-11 rounded-md border text-xs uppercase transition-colors',
              compact ? 'min-w-fit whitespace-nowrap px-1.5 tracking-tight' : 'tracking-widest',
              chosen ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

import { cn } from '@/lib/utils';

interface Option<Value> {
  value: Value;
  label: string;
  hint?: string;
}

interface OptionListProps<Value> {
  label: string;
  options: readonly Option<Value>[];
  value: Value;
  onPick: (value: Value) => void;
}

/** One question's answers, stacked and large enough to tap without care: picking one is the whole step. */
export function OptionList<Value extends string | number>({ label, options, value, onPick }: OptionListProps<Value>) {
  return (
    <div role='group' aria-label={label} className='flex flex-col gap-2'>
      {options.map((option) => (
        <button
          key={option.value}
          type='button'
          aria-pressed={option.value === value}
          onClick={() => onPick(option.value)}
          className={cn(
            'min-h-12 rounded-md border px-4 py-2 text-left transition-colors',
            option.value === value ? 'border-primary' : 'border-border hover:border-primary/50',
          )}
        >
          <span className='block text-sm font-medium'>{option.label}</span>
          {option.hint && <span className='block text-xs text-muted-foreground'>{option.hint}</span>}
        </button>
      ))}
    </div>
  );
}

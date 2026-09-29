'use client';

import { useId, useReducer, useRef, type KeyboardEvent } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { searchEventTypes, typeLabel, type TypeOption } from '@pb/core';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Copy picked by the owner, plain register, 2026-09-29 (log-events PLAN.md phase 2 step 6).
const PLACEHOLDER = 'Search: poker, blackjack, sports…';
const NO_MATCH = 'No match — log it as Other';

// A combobox from the kit's popover plus an input (SCOPE K3(a)); the kit has none. The input keeps
// focus the whole time, so the phone keyboard stays up while the list filters under it, and the
// popover is anchored to it rather than triggered by it, so tapping the input never toggles it.

interface PickerState {
  open: boolean;
  /** What the player typed since opening; null shows every type, not a search for "". */
  query: string | null;
  active: number;
}

type PickerAction =
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'type'; query: string }
  | { kind: 'move'; by: number; count: number };

const CLOSED: PickerState = { open: false, query: null, active: 0 };

function reduce(state: PickerState, action: PickerAction): PickerState {
  switch (action.kind) {
    case 'open':
      return state.open ? state : { open: true, query: null, active: 0 };
    case 'close':
      return CLOSED;
    case 'type':
      return { open: true, query: action.query, active: 0 };
    case 'move':
      return { ...state, open: true, active: (state.active + action.by + action.count) % action.count };
  }
}

// searchEventTypes answers a miss with Other alone. Other is only a "no match" when the player
// did not type something Other itself matches, like "oth".
function isNoMatch(query: string | null, options: readonly TypeOption[]): boolean {
  const needle = query?.trim().toLowerCase() ?? '';
  return needle !== '' && options.length === 1 && options[0].slug === 'other' && !'other'.includes(needle);
}

function Option({ id, option, selected, active, onPick }: {
  id: string; option: TypeOption; selected: boolean; active: boolean; onPick: () => void;
}) {
  return (
    <li
      id={id}
      // Arrow keys can move past the popover's scroll; keep the active row in sight.
      ref={(el) => { if (active) el?.scrollIntoView({ block: 'nearest' }); }}
      role='option'
      aria-selected={active}
      onClick={onPick}
      className={cn(
        'flex h-11 cursor-pointer items-center justify-between rounded-sm px-3 text-sm',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {option.label}
      {selected && <Check aria-hidden='true' className='size-4' />}
    </li>
  );
}

/**
 * Pick what kind of result is being logged (log-events PLAN.md phase 2 step 2, BD-3): poker or a
 * registered event type. Typing filters, arrow keys move, Enter picks, Escape closes; a search
 * that matches nothing offers Other, so it never dead-ends.
 */
export function EventTypePicker({ value, onChange }: { value: string; onChange: (slug: string) => void }) {
  const [state, dispatch] = useReducer(reduce, CLOSED);
  const anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();
  const options = searchEventTypes(state.query ?? '');
  const noMatch = isNoMatch(state.query, options);
  const optionId = (i: number) => `${listId}-${i}`;

  function pick(slug: string) {
    dispatch({ kind: 'close' });
    input.current?.blur();
    if (slug !== value) onChange(slug);
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      dispatch({ kind: 'move', by: e.key === 'ArrowDown' ? 1 : -1, count: options.length });
    } else if (e.key === 'Enter') {
      // Never submit the form under the picker.
      e.preventDefault();
      if (state.open) pick(options[state.active].slug);
    } else if (e.key === 'Escape' && state.open) {
      e.preventDefault();
      dispatch({ kind: 'close' });
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className='text-xs tracking-widest uppercase text-muted-foreground mb-2 block'>What</label>
      <Popover open={state.open} onOpenChange={(open) => dispatch({ kind: open ? 'open' : 'close' })}>
        <PopoverPrimitive.Anchor asChild>
          <div ref={anchor} className='relative'>
            <Input
              ref={input}
              id={inputId}
              role='combobox'
              aria-expanded={state.open}
              aria-controls={listId}
              aria-autocomplete='list'
              aria-activedescendant={state.open ? optionId(state.active) : undefined}
              value={state.query ?? typeLabel(value)}
              placeholder={PLACEHOLDER}
              onChange={(e) => dispatch({ kind: 'type', query: e.target.value })}
              onFocus={(e) => {
                e.currentTarget.select();
                dispatch({ kind: 'open' });
              }}
              onClick={() => dispatch({ kind: 'open' })}
              // Focus never enters the list, so leaving the input is leaving the picker: a tap
              // elsewhere, or the phone keyboard's Done.
              onBlur={() => dispatch({ kind: 'close' })}
              onKeyDown={handleKey}
              autoComplete='off'
              autoCorrect='off'
              spellCheck={false}
              enterKeyHint='done'
              className='h-11 pr-9'
            />
            <ChevronDown aria-hidden='true' className='pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          </div>
        </PopoverPrimitive.Anchor>
        <PopoverContent
          align='start'
          className='w-(--radix-popover-trigger-width) p-1'
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // A press anywhere in the list would blur the input first, closing the list and
          // dropping the keyboard before the tap lands. Scrolling the list is unaffected.
          onPointerDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (anchor.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          {noMatch && <p className='px-3 pt-2 pb-1 text-xs text-muted-foreground'>{NO_MATCH}</p>}
          <ul id={listId} role='listbox' className='max-h-60 overflow-y-auto overscroll-contain'>
            {options.map((option, i) => (
              <Option
                key={option.slug}
                id={optionId(i)}
                option={option}
                selected={option.slug === value}
                active={i === state.active}
                onPick={() => pick(option.slug)}
              />
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

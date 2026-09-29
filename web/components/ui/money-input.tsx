'use client';

import * as React from 'react';
import { formatCents, toCents } from '@pb/core';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const MONEY_PATTERN = /^(\d+\.?\d{0,2}|\.\d{1,2})$/;

// The iOS keyboard animates in over ~300ms; scrolling before it lands centres the input in a
// viewport that is about to shrink, and the keyboard then covers it anyway.
const KEYBOARD_SETTLE_MS = 300;

/**
 * Dollars typed into a `MoneyInput`, as integer cents. `null` means blank or unreadable —
 * never collapse it to 0: a blank cash-out is "not entered yet", not "walked away with $0".
 */
export function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim();
  if (!MONEY_PATTERN.test(trimmed)) return null;
  return toCents(Number(trimmed));
}

/** Keep digits and the first decimal point, at most two places — what a paste of `$1,234.567` becomes `1234.56`. */
function sanitizeMoney(raw: string): string {
  const [whole, ...rest] = raw.replace(/[^\d.]/g, '').split('.');
  if (!rest.length) return whole;
  return `${whole}.${rest.join('').slice(0, 2)}`;
}

/** Cents back to what a person would have typed: `2000` is `20`, `2050` is `20.50`. */
function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : formatCents(cents);
}

function scrollIntoViewSoon(el: HTMLElement) {
  window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), KEYBOARD_SETTLE_MS);
}

export interface MoneyInputProps extends Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  /** Whole-dollar chips under the field, e.g. `[10, 20]`. */
  quickAmounts?: number[];
  /** `add` (default) adds the chip to what is typed; `set` replaces it. */
  quickMode?: 'add' | 'set';
  /** Width and layout of the wrapper; `className` styles the input itself. */
  containerClassName?: string;
}

export function MoneyInput({
  value,
  onValueChange,
  quickAmounts,
  quickMode = 'add',
  containerClassName,
  className,
  onFocus,
  disabled,
  ...props
}: MoneyInputProps) {
  function applyQuick(dollars: number) {
    const base = quickMode === 'add' ? (parseMoneyInput(value) ?? 0) : 0;
    onValueChange(centsToInput(base + toCents(dollars)));
  }

  return (
    <div className={cn('space-y-2', containerClassName)}>
      <div className='relative'>
        <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm'>$</span>
        <Input
          type='text'
          inputMode='decimal'
          enterKeyHint='done'
          autoComplete='off'
          value={value}
          disabled={disabled}
          onChange={(e) => onValueChange(sanitizeMoney(e.target.value))}
          onFocus={(e) => {
            scrollIntoViewSoon(e.currentTarget);
            onFocus?.(e);
          }}
          className={cn('h-11 pl-7 tabular-nums', className)}
          {...props}
        />
      </div>
      {quickAmounts && quickAmounts.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {quickAmounts.map((dollars) => (
            <button
              key={dollars}
              type='button'
              disabled={disabled}
              onClick={() => applyQuick(dollars)}
              className='h-11 min-w-11 rounded-full border border-border px-3 text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground active:bg-accent/10 disabled:opacity-50'
            >
              {quickMode === 'add' ? '+' : '$'}
              {dollars}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

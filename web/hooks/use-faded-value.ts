'use client';

import { useEffect, useState } from 'react';

// Holds the old value on screen for `ms` after `value` changes, so it can fade out before the
// new one mounts. `leaving` is derived, not stored, so the effect only ever sets state from a timer.
export function useFadedValue<T>(value: T, ms: number) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (value === shown) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setShown(value), reduced ? 0 : ms);
    return () => clearTimeout(timer);
  }, [value, shown, ms]);

  return { shown, leaving: value !== shown };
}

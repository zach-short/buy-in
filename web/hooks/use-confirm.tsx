'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { ConfirmDialog, type ConfirmOptions } from '@/components/ui/confirm-dialog';

export type { ConfirmOptions };

export interface ConfirmApi {
  /** Resolves `true` on confirm; `false` on cancel, Escape, a tap outside, or a newer `confirm`. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Render once in the page. There is deliberately no global provider. */
  confirmDialog: ReactNode;
}

export function useConfirm(): ConfirmApi {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    pending.current?.(confirmed);
    pending.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    pending.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
    });
  }, []);

  // A page that unmounts mid-question must not leave its caller awaiting forever.
  useEffect(() => () => pending.current?.(false), []);

  return { confirm, confirmDialog: <ConfirmDialog options={options} onResolve={settle} /> };
}

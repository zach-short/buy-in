'use client';

import { useSyncExternalStore } from 'react';

import { readHostPromptDismissed, rememberHostPromptDismissed } from '@/lib/host-prompt-dismissed';

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The server snapshot is "dismissed", so the server render and the first client render agree and
// a card never flashes at someone who already closed it.
export function useHostPrompt() {
  const dismissed = useSyncExternalStore(subscribe, readHostPromptDismissed, () => true);

  function dismiss(): void {
    rememberHostPromptDismissed();
    listeners.forEach((notify) => notify());
  }

  return { show: !dismissed, dismiss };
}

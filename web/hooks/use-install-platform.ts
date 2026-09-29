'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

export type InstallPlatform = 'ios' | 'android' | 'desktop-chromium' | 'desktop-safari' | 'desktop-other';

// Chromium fires this before it shows its own install UI; it is not in lib.dom.d.ts.
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

type InstallState = {
  /** null on the server render: there is no user agent there, and guessing would mismatch hydration. */
  platform: InstallPlatform | null;
  installed: boolean;
  /** Set only where the browser offered a one-tap install; otherwise the card shows steps. */
  promptInstall: (() => Promise<void>) | null;
};

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; the touch points give it away.
  const isIpad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || isIpad) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Edg\/|Chrome\//.test(ua)) return 'desktop-chromium';
  if (/Safari\//.test(ua)) return 'desktop-safari';
  return 'desktop-other';
}

function isStandalone(): boolean {
  // navigator.standalone is iOS Safari's own flag; display-mode covers everything else.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

// Neither answer changes while the page is open, so there is nothing to subscribe to; the
// external-store hook is only here to give the server render `null` and the client the real value.
const subscribeNever = () => () => {};

export function useInstallPlatform(): InstallState {
  const platform = useSyncExternalStore(subscribeNever, detectPlatform, () => null);
  const alreadyStandalone = useSyncExternalStore(subscribeNever, isStandalone, () => false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => setJustInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    await deferred?.prompt();
    setDeferred(null);
  }, [deferred]);

  return {
    platform,
    installed: alreadyStandalone || justInstalled,
    promptInstall: deferred ? promptInstall : null,
  };
}

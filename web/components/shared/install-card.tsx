'use client';

import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useInstallPlatform } from '@/hooks/use-install-platform';
import type { InstallPlatform } from '@/hooks/use-install-platform';

const STEPS: Record<InstallPlatform, { title: string; steps: string[] }> = {
  ios: {
    title: 'Install on iPhone or iPad',
    steps: [
      'Open Buy-In in Safari — other iOS browsers can’t add it to the Home Screen.',
      'Tap the Share button at the bottom of the screen.',
      'Scroll down and tap Add to Home Screen.',
      'Tap Add. Buy-In opens full-screen from your Home Screen.',
    ],
  },
  android: {
    title: 'Install on Android',
    steps: [
      'Open Buy-In in Chrome.',
      'Tap the ⋮ menu at the top right.',
      'Tap Install app (or Add to Home screen).',
      'Tap Install to confirm.',
    ],
  },
  'desktop-chromium': {
    title: 'Install on your computer',
    steps: [
      'Look for the install icon at the right end of the address bar.',
      'Click it, then click Install.',
      'Or open the ⋮ menu and choose Install Buy-In.',
    ],
  },
  'desktop-safari': {
    title: 'Install on your Mac',
    steps: [
      'In the menu bar, choose File.',
      'Choose Add to Dock.',
      'Click Add. Buy-In opens in its own window from the Dock.',
    ],
  },
  'desktop-other': {
    title: 'Install Buy-In',
    steps: [
      'Open your browser’s menu and look for Install or Add to Home Screen.',
      'Not there? Open Buy-In in Chrome, Edge or Safari, which all support it.',
    ],
  },
};

export function InstallCard() {
  const { platform, installed, promptInstall } = useInstallPlatform();
  if (!platform || installed) return null;
  const { title, steps } = STEPS[platform];

  return (
    <section className='border border-border rounded-md p-4 mb-10 space-y-3'>
      <p className='text-xs tracking-widest uppercase text-primary'>{title}</p>
      {promptInstall ? (
        <Button className='w-full h-10 text-xs tracking-widest uppercase' onClick={promptInstall}>
          <Download aria-hidden='true' />
          Install Buy-In
        </Button>
      ) : (
        <ol className='list-decimal pl-5 space-y-1.5 text-xs text-muted-foreground'>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

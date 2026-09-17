import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ReactNode } from 'react';
import { SWRProvider } from '@/context/swr-provider';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { SessionProvider } from 'next-auth/react';

export const metadata: Metadata = {
  title: { default: 'Poker Bar', template: '%s — Poker Bar' },
  description: 'Home bar management for poker nights',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bar',
  },
};

export const viewport: Viewport = {
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <link rel='manifest' href='/site.webmanifest' />
        <link rel='apple-touch-icon' href='/apple-touch-icon.png' />
        <link rel='icon' href='/favicon.ico' sizes='32x32' />
        <link rel='icon' href='/favicon-96x96.png' sizes='96x96' type='image/png' />
        <link rel='icon' href='/favicon.svg' type='image/svg+xml' />
      </head>
      <body>
        <SessionProvider>
          <ThemeProvider
            attribute='class'
            forcedTheme='dark'
            disableTransitionOnChange
          >
            <SWRProvider>{children}</SWRProvider>
          </ThemeProvider>
        </SessionProvider>
        <Toaster theme='dark' position='bottom-center' richColors />
      </body>
    </html>
  );
}

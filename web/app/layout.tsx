import type { Metadata, Viewport } from 'next';
import { Cinzel } from 'next/font/google';
import './globals.css';
import { ReactNode } from 'react';
import { SWRProvider } from '@/context/swr-provider';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

import { AppShell } from '@/components/shared/layout/app-shell';
import { siteEnv } from '@/lib/env/site';
import { CARD_IMAGE, SITE_DESCRIPTION } from '@/lib/page-metadata';
import { THEME_COLORS } from '@/lib/theme-colors';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-cinzel' });

// Clears the mobile bottom nav (3.5rem bar + --nav-inset, see app-shell.tsx) plus a gap, so a toast never covers the tabs.
const TOAST_OFFSET = 'calc(3.5rem + var(--nav-inset) + 0.75rem)';

export const metadata: Metadata = {
  metadataBase: new URL(siteEnv.origin),
  title: { default: 'Buy-In', template: '%s — Buy-In' },
  description: SITE_DESCRIPTION,
  manifest: '/manifest.json',
  openGraph: { siteName: 'Buy-In', type: 'website', url: '/', title: 'Buy-In', description: SITE_DESCRIPTION, images: [CARD_IMAGE] },
  twitter: { card: 'summary_large_image', title: 'Buy-In', description: SITE_DESCRIPTION, images: [CARD_IMAGE.url] },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Buy-In',
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLORS.background,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' className={cinzel.variable} suppressHydrationWarning>
      <head>
        <link rel='apple-touch-icon' href='/apple-touch-icon.png' />
        <link rel='icon' href='/favicon.ico' sizes='32x32' />
        <link rel='icon' href='/favicon-96x96.png' sizes='96x96' type='image/png' />
      </head>
      <body>
        <ThemeProvider
          attribute='class'
          forcedTheme='dark'
          disableTransitionOnChange
        >
          <SWRProvider>
            <AppShell>{children}</AppShell>
          </SWRProvider>
        </ThemeProvider>
        <Toaster theme='dark' position='bottom-center' offset={TOAST_OFFSET} mobileOffset={TOAST_OFFSET} richColors />
      </body>
    </html>
  );
}

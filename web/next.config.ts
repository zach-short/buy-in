import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

import { clientEnv } from './lib/env/client';

// A RegExp, not a function: workbox serializes each urlPattern into sw.js by its source text, so a
// function closing over this origin would reach the worker with the variable undefined.
function originPattern(url: string): RegExp {
  const origin = new URL(url).origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${origin}/`);
}

const withPWA = withPWAInit({
  dest: 'public',
  // Off: each next/link navigation made the worker re-fetch that path's full HTML and, with the
  // aggressive flag, prefetch its scripts too — extra requests on every navigation.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  // Off (the package defaults it on): a hard location.reload() on every reconnect restarts the live
  // session screen mid-game, and SWR's revalidateOnReconnect already refreshes the data.
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === 'development',
  // true puts the entries below ahead of the package's defaults instead of replacing them, so the
  // static-asset caches stay. Workbox takes the first matching route, so the Supabase rule beats
  // the default cross-origin catch-all (NetworkFirst, 1h), which would otherwise cache balance
  // reads keyed by URL alone — stale on slow wifi, and the last user's rows left on a shared device.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [{ urlPattern: originPattern(clientEnv.supabaseUrl), handler: 'NetworkOnly' }],
  },
});

const nextConfig: NextConfig = {
  turbopack: {},
  // /player-receipt/[token] was a second copy of /portal/[token] over the same portal-scoped token,
  // and the two drifted. Links already texted keep working forever (owner, 2026-09-30), so the old
  // path stays as a redirect, never a page. Config redirects run before proxy.ts (Next.js 16
  // proxy guide, "Execution order"): a signed-out visitor is redirected, not sent to /login, which
  // is why /player-receipt is no longer in proxy.ts's public list. permanent (308) because the page
  // is gone for good; a browser caches it, so reversing means one visit per device to clear.
  async redirects() {
    return [{ source: '/player-receipt/:token', destination: '/portal/:token', permanent: true }];
  },
};

export default withPWA(nextConfig);

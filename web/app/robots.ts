import type { MetadataRoute } from 'next';

import { siteEnv } from '@/lib/env/site';

// The token-bearing paths from proxy.ts's public list: reachable without a login, but each URL
// is one person's receipt, invite or RSVP, so crawlers are told to stay out.
const LINK_ONLY = ['/join/', '/rsvp/', '/receipt', '/player-receipt', '/portal', '/menu'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: LINK_ONLY },
    sitemap: new URL('/sitemap.xml', siteEnv.origin).toString(),
  };
}

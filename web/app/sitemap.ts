import type { MetadataRoute } from 'next';

import { siteEnv } from '@/lib/env/site';

// Only the pages a signed-out visitor can read. Link-only pages (receipts, invites, RSVPs)
// carry a token and must never be listed.
const PUBLIC_PAGES = ['/', '/login', '/privacy', '/terms'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({
    url: new URL(path, siteEnv.origin).toString(),
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.5,
  }));
}

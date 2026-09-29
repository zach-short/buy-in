import type { Metadata } from 'next';

export const SITE_NAME = 'Buy-In';

// A child's openGraph/twitter object replaces the parent's wholesale — including the image the
// root's opengraph-image file adds — so each page names the same image explicitly.
const CARD_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: 'Buy-In — home bar management for poker nights' };

interface PageMetadataInput {
  title: string;
  description: string;
  /** Link-only pages (a token in the URL) must never be indexed or cached as a search result. */
  private?: boolean;
}

/**
 * One place that fills the title, description, Open Graph and Twitter fields together — a
 * child's `openGraph` replaces the parent's wholesale in Next's metadata merge, so a page that
 * set only `title` would lose its card text. The image comes from `app/opengraph-image.tsx`,
 * which the image field below points at.
 */
export function pageMetadata({ title, description, private: isPrivate }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    openGraph: { title: `${title} — ${SITE_NAME}`, description, siteName: SITE_NAME, type: 'website', images: [CARD_IMAGE] },
    twitter: { card: 'summary_large_image', title: `${title} — ${SITE_NAME}`, description, images: [CARD_IMAGE.url] },
    ...(isPrivate ? { robots: { index: false, follow: false } } : {}),
  };
}

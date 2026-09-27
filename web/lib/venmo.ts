import type { VenmoUrls } from '@pb/core';

// The navigation half of the Venmo handoff; @pb/core builds the URLs but may not touch
// `window` (packages/core/src/venmo.ts). Replaces the three copies this lived in before
// phase 7 (bar-api.ts openVenmo, receipt-ui, player-receipt): try the app, and if the page
// is still visible after 1.5 s the app did not open, so fall back to the web URL.
export function openVenmo({ deepLink, webUrl }: VenmoUrls): void {
  window.location.href = deepLink;
  setTimeout(() => {
    if (!document.hidden) window.location.href = webUrl;
  }, 1500);
}

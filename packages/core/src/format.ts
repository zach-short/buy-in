// Moved verbatim from web/lib/bar-api.ts:98-104. The locale and option objects are
// unchanged on purpose: these strings appear on receipts people already have, and
// changing how a date reads is a screen change this migration does not make
// (DESIGN.md §8.2).

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

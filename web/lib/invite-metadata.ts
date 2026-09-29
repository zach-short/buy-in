import type { Metadata } from 'next';

import { pageMetadata } from '@/lib/page-metadata';
import type { InvitePreview } from '@/lib/supabase/public-server';

// The server has no idea what timezone the host lives in, and Vercel runs in UTC, where a
// Friday-evening game lands on Saturday. One fixed zone is wrong for some hosts but never
// wrong by a day for the owner's; per-bar timezones would need a column nobody has asked for.
const GAME_TZ = 'America/New_York';

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: GAME_TZ,
    timeZoneName: 'short',
  });
}

const JOIN_FALLBACK = pageMetadata({
  title: "You're invited",
  description: "You've been invited to join a poker table on Buy-In. Tap to pick your name and get a seat.",
  private: true,
});

const RSVP_FALLBACK = pageMetadata({
  title: 'RSVP',
  description: "Let the host know if you're in for game night. One tap: I'm in, Can't make it, or Maybe.",
  private: true,
});

/** Card for /join/<token>: the table's name, and the game night when the link is for one. */
export function joinMetadata(preview: InvitePreview | null): Metadata {
  if (!preview) return JOIN_FALLBACK;
  const night = preview.gameName && preview.scheduledAt ? ` ${preview.gameName} is ${whenLabel(preview.scheduledAt)}.` : '';
  return pageMetadata({
    title: `Join ${preview.barName}`,
    description: `You've been invited to join ${preview.barName} on Buy-In.${night} Tap to pick your name and get a seat.`,
    private: true,
  });
}

/** Card for /rsvp/<token>: the game night's name and time, or the table if the link has no game. */
export function rsvpMetadata(preview: InvitePreview | null): Metadata {
  if (!preview?.gameName || !preview.scheduledAt) return RSVP_FALLBACK;
  const { gameName, barName, scheduledAt, cancelled } = preview;
  return pageMetadata({
    title: cancelled ? `${gameName} (cancelled)` : `RSVP: ${gameName}`,
    description: cancelled
      ? `${gameName} at ${barName} was cancelled.`
      : `${gameName} at ${barName}, ${whenLabel(scheduledAt)}. Are you in? One tap: I'm in, Can't make it, or Maybe.`,
    private: true,
  });
}

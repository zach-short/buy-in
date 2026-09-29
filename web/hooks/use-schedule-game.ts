'use client';

import { useState, useSyncExternalStore } from 'react';

import type { ShareResult } from '@/lib/share';
import {
  createScheduledGame,
  mintGameInvite,
  rsvpUrl,
  shareGameInvite,
  type GameRef,
} from '@/lib/supabase/scheduled-games';

export interface ScheduleGameForm {
  name: string;
  setName: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  time: string;
  setTime: (value: string) => void;
  /** The earliest pickable date, as the date input's `min`. */
  today: string;
  /** True once the game exists: a retry then only mints the invite, so the fields are fixed. */
  scheduled: boolean;
  canSubmit: boolean;
  submitting: boolean;
  inviteUrl: string | null;
  submit: () => Promise<void>;
  /** Shares or copies the ready-to-paste invite message; 'failed' before there is an invite. */
  shareInvite: () => Promise<ShareResult>;
}

// The host's own calendar date. toISOString would give UTC's, which is already tomorrow on
// any evening in the Americas — exactly when a game gets scheduled.
export function localDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** The host's own wall-clock time, as a time input's `HH:MM` value. */
export function localTimeValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// A date-time string with no offset parses as local time (ECMAScript Date Time String
// Format), i.e. the host's clock; toISOString then carries that instant to timestamptz.
export function toScheduledAt(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

// The date never changes under an open form, so there is nothing to subscribe to; the
// external-store hook only gives the server render '' and the browser its own calendar day.
// Reading it during render instead would stamp the server's UTC day into the HTML.
const subscribeNever = () => () => {};

function useLocalToday(): string {
  return useSyncExternalStore(subscribeNever, () => localDateValue(new Date()), () => '');
}

export function useScheduleGame(): ScheduleGameForm {
  const today = useLocalToday();
  const [name, setName] = useState('');
  // null until the host picks, so the field shows today without an effect copying it in.
  const [picked, setDate] = useState<string | null>(null);
  const date = picked ?? today;
  const [time, setTime] = useState('19:00');
  const [submitting, setSubmitting] = useState(false);
  // Scheduling and minting are two requests, not one transaction. Holding the game means a
  // retry after a failed mint mints only the invite, rather than scheduling the night twice.
  const [game, setGame] = useState<GameRef | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setSubmitting(true);
    try {
      const target = game ?? (await createScheduledGame(name.trim(), toScheduledAt(date, time)));
      setGame(target);
      setInviteToken(await mintGameInvite(target));
    } finally {
      setSubmitting(false);
    }
  }

  // The fields are locked once the game exists, so they still describe the game that was made.
  async function shareInvite(): Promise<ShareResult> {
    if (!inviteToken) return 'failed';
    return shareGameInvite({ name: name.trim(), scheduled_at: toScheduledAt(date, time) }, inviteToken);
  }

  const filled = name.trim() !== '' && date !== '' && time !== '';
  return {
    name, setName, date, setDate, time, setTime,
    today,
    scheduled: game !== null,
    canSubmit: !submitting && (game !== null || filled),
    submitting, submit, shareInvite,
    inviteUrl: inviteToken ? rsvpUrl(inviteToken) : null,
  };
}

'use client';

import { useState } from 'react';

import { createScheduledGame, mintGameInvite, rsvpUrl, type GameRef } from '@/lib/supabase/scheduled-games';

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
}

// The host's own calendar date. toISOString would give UTC's, which is already tomorrow on
// any evening in the Americas — exactly when a game gets scheduled.
function localDateValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A date-time string with no offset parses as local time (ECMAScript Date Time String
// Format), i.e. the host's clock; toISOString then carries that instant to timestamptz.
function toScheduledAt(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

export function useScheduleGame(): ScheduleGameForm {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [submitting, setSubmitting] = useState(false);
  // Scheduling and minting are two requests, not one transaction. Holding the game means a
  // retry after a failed mint mints only the invite, rather than scheduling the night twice.
  const [game, setGame] = useState<GameRef | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setSubmitting(true);
    try {
      const target = game ?? (await createScheduledGame(name.trim(), toScheduledAt(date, time)));
      setGame(target);
      setInviteUrl(rsvpUrl(await mintGameInvite(target)));
    } finally {
      setSubmitting(false);
    }
  }

  const filled = name.trim() !== '' && date !== '' && time !== '';
  return {
    name, setName, date, setDate, time, setTime,
    today: localDateValue(new Date()),
    scheduled: game !== null,
    canSubmit: !submitting && (game !== null || filled),
    submitting, inviteUrl, submit,
  };
}

'use client';

import { useState } from 'react';

import { localDateValue, localTimeValue, toScheduledAt } from '@/hooks/use-schedule-game';
import { updateScheduledGame, type ScheduledGameRow } from '@/lib/supabase/scheduled-games';

export interface EditGameForm {
  name: string;
  setName: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  time: string;
  setTime: (value: string) => void;
  saving: boolean;
  canSave: boolean;
  save: () => Promise<void>;
}

// Seeded from the game in the host's own time zone, the same wall clock /schedule/new wrote
// it from, so saving untouched fields writes back the same instant.
export function useEditGame(game: ScheduledGameRow): EditGameForm {
  const at = new Date(game.scheduled_at);
  const [name, setName] = useState(game.name);
  const [date, setDate] = useState(() => localDateValue(at));
  const [time, setTime] = useState(() => localTimeValue(at));
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    setSaving(true);
    try {
      await updateScheduledGame(game.id, name.trim(), toScheduledAt(date, time));
    } finally {
      setSaving(false);
    }
  }

  const filled = name.trim() !== '' && date !== '' && time !== '';
  return { name, setName, date, setDate, time, setTime, saving, canSave: filled && !saving, save };
}

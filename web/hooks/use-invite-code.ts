'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { isValidCustomCode, normalizeInviteCode } from '@pb/core';
import { refreshInviteCode, setInviteCode } from '@/lib/supabase/standing-invites';

type Busy = 'save' | 'refresh' | null;

// Copy is the owner's (R7, the terse set, 2026-09-29).
const TAKEN = 'That code is taken. Try another.';
const BAD_SHAPE = 'A code is 4 to 8 letters or digits.';

/** Renaming one invite's code, and drawing a new random one (0028 set_invite_code, refresh_invite_code). */
export function useInviteCode(token: string, onChanged: () => Promise<unknown>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<Busy>(null);

  async function run(kind: Exclude<Busy, null>, write: () => Promise<string | null>) {
    setBusy(kind);
    try {
      const code = await write();
      if (code === null) return toast.error(TAKEN);
      toast.success(`Code is now ${code}`);
      setEditing(false);
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function save() {
    if (!isValidCustomCode(draft)) return void toast.error(BAD_SHAPE);
    void run('save', () => setInviteCode(token, normalizeInviteCode(draft)));
  }

  function startEditing(current: string | null) {
    setDraft(current ?? '');
    setEditing(true);
  }

  return {
    editing, draft, setDraft, busy, save, startEditing,
    cancel: () => setEditing(false),
    refresh: () => void run('refresh', () => refreshInviteCode(token)),
  };
}

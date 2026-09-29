import { useState } from 'react';
import { toast } from 'sonner';

import { createPlayer } from '@/lib/supabase/writes';

// writeErrorMessage's words for the unique (bar_id, name) violation. The inline warning should
// have caught it first; this covers a player added from another device a moment ago.
const NAME_TAKEN = 'Player with this name already exists';

function addFailure(e: Error, name: string): string {
  return e.message === NAME_TAKEN ? `There's already a player named ${name}. Pick a different name.` : e.message;
}

export function useAddPlayer(onAdded: () => void) {
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [venmo, setVenmo]   = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setName(''); setPhone(''); setVenmo('');
  }

  async function submit(): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) return false;
    setSaving(true);
    try {
      await createPlayer({ name: trimmed, phone: phone.trim(), venmo: venmo.trim() });
      toast.success(`${trimmed} added`);
      onAdded();
      reset();
      return true;
    } catch (e) {
      toast.error(addFailure(e as Error, trimmed));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { name, setName, phone, setPhone, venmo, setVenmo, saving, submit, reset };
}

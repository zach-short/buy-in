import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PlayerRow } from '@/lib/supabase/queries';
import { updatePlayer } from '@/lib/supabase/writes';

/** Name, phone and Venmo for one player. Mounted only while editing, so it starts from the row. */
export function PlayerEditForm({ player, onSaved, onClose }: {
  player: PlayerRow;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(player.name);
  const [phone, setPhone] = useState(player.phone ?? '');
  const [venmo, setVenmo] = useState(player.venmo ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updatePlayer(player.id, { name: name.trim(), phone: phone.trim(), venmo: venmo.trim() });
      onSaved();
      onClose();
      toast.success('Saved');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='border border-border rounded-md p-4 mb-8 space-y-3'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>
        Edit Player
      </p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className='h-11'
        placeholder='Name'
        aria-label='Name'
        autoFocus
      />
      <Input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className='h-11'
        placeholder='Phone (e.g. +15551234567)'
        aria-label='Phone'
        type='tel'
      />
      <Input
        value={venmo}
        onChange={(e) => setVenmo(e.target.value)}
        className='h-11'
        placeholder='Venmo handle (e.g. @john-doe)'
        aria-label='Venmo handle'
      />
      <div className='flex gap-2'>
        <Button
          variant='outline'
          className='flex-1 h-11 text-xs tracking-widest uppercase'
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          className='flex-1 h-11 text-xs tracking-widest uppercase'
          onClick={save}
          disabled={saving || !name.trim()}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

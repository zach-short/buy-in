import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

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

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
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
    <form onSubmit={(e) => void save(e)} className='border border-border rounded-md p-4 mb-8 space-y-3'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>
        Edit Player
      </p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className='h-11'
        placeholder='Name'
        aria-label='Name'
        autoCapitalize='words'
        autoComplete='off'
        autoFocus
      />
      <Input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className='h-11'
        placeholder='Phone (optional)'
        aria-label='Phone'
        type='tel'
        autoComplete='tel'
      />
      <Input
        value={venmo}
        onChange={(e) => setVenmo(e.target.value)}
        className='h-11'
        placeholder='Venmo handle (e.g. @john-doe)'
        aria-label='Venmo handle'
        autoCapitalize='none'
        autoCorrect='off'
      />
      <div className='flex gap-2'>
        <Button
          type='button'
          variant='outline'
          className='flex-1 h-11 text-xs tracking-widest uppercase'
          onClick={onClose}
          disabled={saving}
        >
          <X aria-hidden='true' />
          Cancel
        </Button>
        <Button
          type='submit'
          className='flex-1 h-11 text-xs tracking-widest uppercase'
          disabled={saving || !name.trim()}
        >
          <Check aria-hidden='true' />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

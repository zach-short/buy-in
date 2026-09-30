import type { FormEvent } from 'react';
import { UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { findNameClash } from './player-list';
import { useAddPlayer } from './use-add-player';

interface AddPlayerFormProps {
  /** Every player's name at the bar, archived included: the unique constraint counts them too. */
  existingNames: readonly string[];
  onAdded: () => void;
  onClose: () => void;
}

export function AddPlayerForm({ existingNames, onAdded, onClose }: AddPlayerFormProps) {
  const form = useAddPlayer(onAdded);
  const clash = findNameClash(form.name, existingNames);
  const blocked = clash?.kind === 'exact';

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (blocked || form.saving) return;
    if (await form.submit()) onClose();
  }

  function handleCancel() {
    form.reset();
    onClose();
  }

  return (
    <form onSubmit={(e) => void handleAdd(e)} className='border border-border rounded-md p-4 mb-6 space-y-3'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>New Player</p>
      <Input
        autoFocus
        value={form.name}
        onChange={(e) => form.setName(e.target.value)}
        placeholder='Name'
        aria-label='Name'
        autoCapitalize='words'
        autoComplete='off'
        aria-describedby={clash ? 'player-name-clash' : undefined}
        className='h-11'
      />
      {clash && (
        <p id='player-name-clash' role='status' className={`text-xs ${blocked ? 'text-destructive' : 'text-muted-foreground'}`}>
          {blocked
            ? `There's already a ${clash.name}. Pick a different name.`
            : `There's already a ${clash.name} — add anyway?`}
        </p>
      )}
      <Input
        value={form.phone}
        onChange={(e) => form.setPhone(e.target.value)}
        placeholder='Phone (optional)'
        aria-label='Phone'
        type='tel'
        autoComplete='tel'
        className='h-11'
      />
      <Input
        value={form.venmo}
        onChange={(e) => form.setVenmo(e.target.value)}
        placeholder='Venmo handle (e.g. @john-doe)'
        aria-label='Venmo handle'
        autoCapitalize='none'
        autoCorrect='off'
        className='h-11'
      />
      <div className='flex gap-2'>
        <Button type='button' variant='outline' className='flex-1 h-11 text-xs tracking-widest uppercase' onClick={handleCancel} disabled={form.saving}><X aria-hidden='true' /> Cancel</Button>
        <Button type='submit' className='flex-1 h-11 text-xs tracking-widest uppercase' disabled={form.saving || !form.name.trim() || blocked}>
          <UserPlus aria-hidden='true' />
          {form.saving ? 'Saving…' : clash?.kind === 'similar' ? 'Add anyway' : 'Add Player'}
        </Button>
      </div>
    </form>
  );
}

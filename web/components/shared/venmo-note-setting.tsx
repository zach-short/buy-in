'use client';

import { useSWRConfig } from 'swr';
import { toast } from 'sonner';

import { DEFAULT_VENMO_NOTE, VENMO_NOTE_TEMPLATE_MAX_LENGTH, renderVenmoNote } from '@pb/core';
import { Check } from 'lucide-react';
import { useVenmoNoteTemplate } from '@/hooks/use-venmo-note-template';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Sample values for the preview only. A real note is rendered per payment, with that
// player's amount and that night's name.
const PREVIEW_VARS = { amountCents: 4250, sessionName: 'Friday Night' };

export function VenmoNoteSetting() {
  const { value, setValue, isLoading, error, dirty, saving, save } = useVenmoNoteTemplate();
  const { mutate } = useSWRConfig();

  async function handleSave() {
    try {
      await save();
      toast.success('Venmo note saved');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (error) {
    // The app's SWRConfig does not retry on error; this is the host's only way back without a reload.
    return (
      <div className='mb-6' role='alert'>
        <p className='text-xs text-destructive'>Couldn&apos;t load the Venmo note: {error.message}</p>
        <button type='button' onClick={() => void mutate('bar_settings')} className='min-h-11 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className='border border-border rounded-md p-4 mb-6 space-y-3'>
      <Label htmlFor='venmo-note-template' className='text-xs tracking-widest uppercase text-muted-foreground'>
        Venmo note
      </Label>
      <Input
        id='venmo-note-template'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && dirty && handleSave()}
        placeholder={DEFAULT_VENMO_NOTE}
        maxLength={VENMO_NOTE_TEMPLATE_MAX_LENGTH}
        disabled={isLoading || saving}
        className='h-11'
      />
      <p className='text-xs text-muted-foreground'>
        Shown on every Venmo request. Add {'{{amount}}'} to include what they owe, or {'{{session}}'} for the night&apos;s name.
      </p>
      <p className='text-xs text-muted-foreground'>
        Preview: <span className='text-foreground'>{renderVenmoNote(value, PREVIEW_VARS)}</span>
      </p>
      <Button className='w-full h-11 text-xs tracking-widest uppercase' onClick={handleSave} disabled={!dirty || saving || isLoading}>
        <Check aria-hidden='true' />
        {saving ? 'Saving…' : 'Save Note'}
      </Button>
    </div>
  );
}

'use client';

import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { Check } from 'lucide-react';

import { useDefaultBuyIn } from '@/hooks/use-default-buy-in';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DefaultBuyInSetting() {
  const { value, setValue, isLoading, error, dirty, saving, save } = useDefaultBuyIn();
  const { mutate } = useSWRConfig();

  async function handleSave() {
    try {
      await save();
      toast.success('Default buy-in saved');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (error) {
    // The app's SWRConfig does not retry on error; this is the host's only way back without a reload.
    return (
      <div className='mb-6' role='alert'>
        <p className='text-xs text-destructive'>Couldn&apos;t load the default buy-in: {error.message}</p>
        <button type='button' onClick={() => void mutate('bar_settings')} className='min-h-11 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className='border border-border rounded-md p-4 mb-6 space-y-3'>
      <Label htmlFor='default-buy-in' className='text-xs tracking-widest uppercase text-muted-foreground'>
        Default buy-in
      </Label>
      <div className='relative'>
        <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm'>$</span>
        <Input
          id='default-buy-in'
          type='number'
          inputMode='decimal'
          min='0'
          step='5'
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && dirty && handleSave()}
          placeholder={isLoading ? 'Loading…' : undefined}
          disabled={isLoading || saving}
          className='h-11 pl-7'
        />
      </div>
      <p className='text-xs text-muted-foreground'>
        Pre-fills every player&apos;s buy-in when you start a session. You can still change it for any one night.
      </p>
      <Button className='w-full h-11 text-xs tracking-widest uppercase' onClick={handleSave} disabled={!dirty || saving || isLoading}>
        <Check aria-hidden='true' />
        {saving ? 'Saving…' : 'Save Buy-In'}
      </Button>
    </div>
  );
}

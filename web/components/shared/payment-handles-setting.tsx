'use client';

import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { Check } from 'lucide-react';

import { usePaymentHandles } from '@/hooks/use-payment-handles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PaymentHandlesSetting() {
  const { venmo, cashapp, setVenmo, setCashapp, isLoading, error, dirty, saving, save } = usePaymentHandles();
  const { mutate } = useSWRConfig();

  async function handleSave() {
    try {
      await save();
      toast.success('Payment handles saved');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (error) {
    // The app's SWRConfig does not retry on error; this is the host's only way back without a reload.
    return (
      <div className='mb-6' role='alert'>
        <p className='text-xs text-destructive'>Couldn&apos;t load your payment handles: {error.message}</p>
        <button type='button' onClick={() => void mutate('payment_handles')} className='min-h-11 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className='border border-border rounded-md p-4 mb-6 space-y-3'>
      <Label htmlFor='venmo-handle' className='text-xs tracking-widest uppercase text-muted-foreground'>
        Venmo handle
      </Label>
      <Input
        id='venmo-handle'
        value={venmo}
        onChange={(e) => setVenmo(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && dirty && handleSave()}
        placeholder='@your-handle'
        autoCapitalize='none'
        autoCorrect='off'
        disabled={isLoading || saving}
        className='h-11'
      />
      <Label htmlFor='cashapp-handle' className='text-xs tracking-widest uppercase text-muted-foreground'>
        Cash App cashtag
      </Label>
      <Input
        id='cashapp-handle'
        value={cashapp}
        onChange={(e) => setCashapp(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && dirty && handleSave()}
        placeholder='$yourtag'
        autoCapitalize='none'
        autoCorrect='off'
        disabled={isLoading || saving}
        className='h-11'
      />
      <p className='text-xs text-muted-foreground'>Where players pay you. Leave one blank to remove it.</p>
      <Button className='w-full h-11 text-xs tracking-widest uppercase' onClick={handleSave} disabled={!dirty || saving || isLoading}>
        <Check aria-hidden='true' />
        {saving ? 'Saving…' : 'Save Handles'}
      </Button>
    </div>
  );
}

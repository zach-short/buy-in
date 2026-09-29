'use client';

import { toast } from 'sonner';

import { usePaymentHandles } from '@/hooks/use-payment-handles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PaymentHandlesSetting() {
  const { venmo, cashapp, setVenmo, setCashapp, isLoading, error, dirty, saving, save } = usePaymentHandles();

  async function handleSave() {
    try {
      await save();
      toast.success('Payment handles saved');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (error) {
    return <p className='text-xs text-destructive mb-6'>Couldn&apos;t load your payment handles: {error.message}</p>;
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
      <Button className='w-full h-10 text-xs tracking-widest uppercase' onClick={handleSave} disabled={!dirty || saving || isLoading}>
        {saving ? 'Saving…' : 'Save Handles'}
      </Button>
    </div>
  );
}

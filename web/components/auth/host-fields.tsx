import { Input } from '@/components/ui/input';
import type { BarFields } from '@/lib/supabase/pending-bar';

export function HostFields({
  fields,
  setField,
}: {
  fields: BarFields;
  setField: <K extends keyof BarFields>(key: K, value: BarFields[K]) => void;
}) {
  return (
    <div className='space-y-3 pt-2'>
      <p className='text-xs text-muted-foreground tracking-widest uppercase'>Your table</p>
      <Input
        placeholder='Table name'
        value={fields.barName}
        onChange={(e) => setField('barName', e.target.value)}
        required
        className='h-11'
      />
      <Input
        placeholder='Venmo handle (optional)'
        value={fields.venmo}
        onChange={(e) => setField('venmo', e.target.value)}
        autoCapitalize='none'
        autoCorrect='off'
        className='h-11'
      />
      <Input
        placeholder='Cash App handle (optional)'
        value={fields.cashapp}
        onChange={(e) => setField('cashapp', e.target.value)}
        autoCapitalize='none'
        autoCorrect='off'
        className='h-11'
      />
    </div>
  );
}

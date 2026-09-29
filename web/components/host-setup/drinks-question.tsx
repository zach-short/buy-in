'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface DrinksQuestionProps {
  onAnswer: (serves: boolean | null) => Promise<void>;
}

// Host-setup phase 3, step 1. Copy is SCOPE.md §7 Q8 (warm). Shown only where the owner has
// allowed drinks (BD-7), and there No is the preselected answer: it carries the primary style,
// Yes needs a deliberate tap, and Skip leaves drinks off too.
export function DrinksQuestion({ onAnswer }: DrinksQuestionProps) {
  const [saving, setSaving] = useState(false);

  async function answer(serves: boolean | null) {
    setSaving(true);
    try {
      await onAnswer(serves);
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className='border border-border rounded-md p-4 mb-10'>
      <p className='text-sm font-medium mb-4'>Will there be drinks on the tab?</p>
      <div role='group' aria-label='Will there be drinks on the tab?' className='grid grid-cols-2 gap-3'>
        <Button variant='outline' disabled={saving} onClick={() => answer(true)}><Check aria-hidden='true' /> Yes</Button>
        <Button disabled={saving} onClick={() => answer(false)}><X aria-hidden='true' /> No</Button>
      </div>
      <Button variant='link' disabled={saving} className='w-full mt-2 text-muted-foreground' onClick={() => answer(null)}>
        Skip
      </Button>
    </div>
  );
}

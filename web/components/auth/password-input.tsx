'use client';

import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Each instance owns its own visibility, so revealing the password does not reveal its confirmation.
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className='relative'>
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} />
      <button
        type='button'
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={props.disabled}
        className='absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground disabled:opacity-50'
      >
        <Icon className='size-4' aria-hidden />
      </button>
    </div>
  );
}

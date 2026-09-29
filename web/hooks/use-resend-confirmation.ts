'use client';

import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { confirmRedirectUrl } from '@/lib/supabase/sign-up';

// Matches the project's "Minimum interval per user" (60 s, Auth > Emails > SMTP settings):
// a shorter cooldown here would only surface Supabase's rate-limit error.
const COOLDOWN_S = 60;

export type ResendStatus = 'idle' | 'sending' | 'sent' | { error: string };

export interface ResendState {
  status: ResendStatus;
  cooldown: number;
  resend: () => Promise<void>;
}

export function useResendConfirmation(email: string, next: string): ResendState {
  const [status, setStatus] = useState<ResendStatus>('idle');
  // Starts running: the sign-up that brought the visitor here just sent one.
  const [cooldown, setCooldown] = useState(COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend(): Promise<void> {
    setStatus('sending');
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: confirmRedirectUrl(next) },
    });
    if (error) return setStatus({ error: error.message });
    setStatus('sent');
    setCooldown(COOLDOWN_S);
  }

  return { status, cooldown, resend };
}

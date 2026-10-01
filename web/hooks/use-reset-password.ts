'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { saveNewPassword } from '@/lib/supabase/password-reset';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

// The /reset-password form: a new password typed twice, saved on the session the reset link set.
export function useResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  // Stays busy on success so nothing can be resubmitted while the route changes.
  async function save(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setBusy(true);
    setError('');
    try {
      const result = await saveNewPassword(password);
      if (result === 'signed-out') return setSignedOut(true);
      // The new password stands either way. "May": GoTrue can have signed the other devices out on
      // its own when the password changed (saveNewPassword), so a failed call does not prove they
      // are still in.
      if (result === 'saved') toast.success('Password saved.');
      else toast.warning('Password saved. Your other devices may still be signed in.');
      router.replace('/');
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  }

  return { password, setPassword, confirmPassword, setConfirmPassword, error, busy, signedOut, save };
}

export type ResetPasswordForm = ReturnType<typeof useResetPassword>;

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { ConfirmApi } from '@/hooks/use-confirm';
import { kickPlayer, reassignPlayerAccount, swapPlayerAccounts, unlinkPlayer } from '@/lib/supabase/claims';
import type { PlayerRow } from '@/lib/supabase/queries';

// PASSOFF item 17's host override on /players/[id]: undo, swap or move the account linked to a
// row, because a friend will pick the wrong name (owner, 2026-09-29). None of these touches a
// balance — a balance belongs to the row; only who can see the row changes. Confirm prompts and
// toasts are the owner's copy (R7, chosen 2026-09-29).
//
// Kick (invite-codes SCOPE A6, A10) is the one action here that is gated on the balance: the
// database refuses anything but exactly $0.00, and the panel disables the button to match.

type Action = 'unlink' | 'swap' | 'move' | 'kick';

/** Unlink, swap, move and kick for one player row; `onChanged` refetches the roster, `confirm` is the page's `useConfirm`. */
export function usePlayerAccount(player: PlayerRow, onChanged: () => Promise<unknown>, confirm: ConfirmApi['confirm']) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);

  async function run(action: Action, prompt: string, write: () => Promise<void>, done: string, confirmLabel = 'Continue') {
    if (!(await confirm({ title: 'Are you sure?', description: prompt, confirmLabel, destructive: action === 'kick' }))) return false;
    setBusy(action);
    try {
      await write();
      toast.success(done);
      await onChanged();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const unlink = () => run('unlink',
    `Unlink ${player.name} from their account? They stop seeing this balance until it is linked again.`,
    () => unlinkPlayer(player.id), 'Unlinked');

  const swap = (other: PlayerRow) => run('swap',
    `Swap the accounts on ${player.name} and ${other.name}? Each person will then see the other's balance.`,
    () => swapPlayerAccounts(player.id, other.id), 'Accounts swapped');

  // The row this page shows is deleted on success, so the page follows the account to its new row.
  async function move(target: PlayerRow) {
    const moved = await run('move',
      `Move this account to ${target.name} and delete ${player.name}? Only works if ${player.name} has no history.`,
      () => reassignPlayerAccount(player.id, target.id), `Moved to ${target.name}`);
    if (moved) router.replace(`/players/${target.id}`);
  }

  // Copy is the owner's (R7, the terse set, 2026-09-29). The replaced invites are the part a host
  // would not guess: every link and code they already sent stops working (0028 rotate_table_invites).
  const kick = () => run('kick',
    `Kick ${player.name}? They lose access to this table. Their history stays.`,
    () => kickPlayer(player.id), `${player.name} kicked. Your invites were replaced — share the new ones.`, 'Kick');

  return { busy, unlink, swap, move, kick };
}

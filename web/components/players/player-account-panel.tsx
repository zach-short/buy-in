import { useState } from 'react';
import { ArrowRightLeft, DoorOpen, Unlink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/use-confirm';
import { usePlayerAccount } from '@/hooks/use-player-account';
import type { PlayerRow } from '@/lib/supabase/queries';

const LABEL = 'text-xs tracking-widest uppercase text-muted-foreground';
const SELECT = 'flex-1 min-w-0 h-11 rounded-md border border-input bg-transparent px-3 text-sm';
const ACTION = 'h-11 text-xs tracking-widest uppercase shrink-0';

interface PickProps {
  label: string;
  options: PlayerRow[];
  busy: boolean;
  onPick: (player: PlayerRow) => void;
}

// A select plus its button. Nothing happens until the host confirms (the hook asks through useConfirm).
function PickAndAct({ label, options, busy, onPick }: PickProps) {
  const [id, setId] = useState('');
  const chosen = options.find((p) => p.id === id);
  if (!options.length) return null;
  return (
    <div className='flex gap-2'>
      <select className={SELECT} value={id} onChange={(e) => setId(e.target.value)} aria-label={label}>
        <option value=''>{label}…</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>{p.name}{p.user_id ? '' : ' (not linked)'}</option>
        ))}
      </select>
      <Button variant='outline' className={ACTION} disabled={!chosen || busy} onClick={() => chosen && onPick(chosen)}>
        <ArrowRightLeft aria-hidden='true' />
        {label}
      </Button>
    </div>
  );
}

interface KickProps {
  balanceCents: number | null;
  busy: boolean;
  kicking: boolean;
  onKick: () => void;
}

// Kick needs a balance of exactly $0.00 (SCOPE A6), so it is disabled, with the reason, for any
// other balance; while the balance is still loading it is disabled with no reason yet. The
// database checks again under lock (0029), so this is a courtesy, never the gate. Copy is the
// owner's (R7, the terse set, 2026-09-29).
function KickButton({ balanceCents, busy, kicking, onKick }: KickProps) {
  const even = balanceCents === 0;
  return (
    <div className='space-y-1.5'>
      <Button variant='destructive' className='w-full h-11 text-xs tracking-widest uppercase' onClick={onKick} disabled={!even || busy}>
        <DoorOpen aria-hidden='true' />
        {kicking ? 'Kicking…' : 'Kick'}
      </Button>
      {balanceCents !== null && !even && (
        <p className='text-xs text-muted-foreground'>Balance must be $0.00 to kick.</p>
      )}
    </div>
  );
}

/**
 * Who this row belongs to, and the host's override (PASSOFF item 17). Swap works whether or not
 * this row is linked; Move is only for a linked row — an account that joined as someone new and
 * needs to land on its real, unlinked row. Kick (invite codes, PASSOFF item 31) is only for a
 * linked row too. Unlink, swap and move wording is provisional (R7).
 */
export function PlayerAccountPanel({ player, players, balanceCents, onChanged }: {
  player: PlayerRow;
  players: PlayerRow[];
  /** Null while any list the balance sums is still loading (the page's own rule). */
  balanceCents: number | null;
  onChanged: () => Promise<unknown>;
}) {
  const { confirm, confirmDialog } = useConfirm();
  const account = usePlayerAccount(player, onChanged, confirm);
  const others = players.filter((p) => p.id !== player.id && p.bar_id === player.bar_id);
  const linked = player.user_id !== null;
  const swappable = linked ? others : others.filter((p) => p.user_id !== null);

  return (
    <div className='border border-border rounded-md p-4 mb-8 space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <p className={LABEL}>{linked ? 'Linked to an account' : 'Not linked to an account'}</p>
        {linked && (
          <Button variant='outline' className='h-11 text-xs tracking-widest uppercase' onClick={() => void account.unlink()} disabled={account.busy !== null}>
            <Unlink aria-hidden='true' />
            {account.busy === 'unlink' ? 'Unlinking…' : 'Unlink'}
          </Button>
        )}
      </div>
      <PickAndAct label='Swap with' options={swappable} busy={account.busy !== null} onPick={(p) => void account.swap(p)} />
      {linked && (
        <PickAndAct label='Move to' options={others.filter((p) => p.user_id === null)} busy={account.busy !== null} onPick={(p) => void account.move(p)} />
      )}
      {linked && (
        <KickButton balanceCents={balanceCents} busy={account.busy !== null} kicking={account.busy === 'kick'} onKick={() => void account.kick()} />
      )}
      {confirmDialog}
    </div>
  );
}

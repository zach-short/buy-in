import { useState } from 'react';

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
        {label}
      </Button>
    </div>
  );
}

/**
 * Who this row belongs to, and the host's override (PASSOFF item 17). Swap works whether or not
 * this row is linked; Move is only for a linked row — an account that joined as someone new and
 * needs to land on its real, unlinked row. All wording is provisional (R7).
 */
export function PlayerAccountPanel({ player, players, onChanged }: {
  player: PlayerRow;
  players: PlayerRow[];
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
            {account.busy === 'unlink' ? 'Unlinking…' : 'Unlink'}
          </Button>
        )}
      </div>
      <PickAndAct label='Swap with' options={swappable} busy={account.busy !== null} onPick={(p) => void account.swap(p)} />
      {linked && (
        <PickAndAct label='Move to' options={others.filter((p) => p.user_id === null)} busy={account.busy !== null} onPick={(p) => void account.move(p)} />
      )}
      {confirmDialog}
    </div>
  );
}

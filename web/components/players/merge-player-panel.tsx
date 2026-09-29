import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { describeBalance } from '@/components/players/balance-label';
import { useMergePlayer } from '@/components/players/use-merge-player';
import type { ConfirmApi } from '@/hooks/use-confirm';
import { isPlayerArchived } from '@/lib/supabase/player-admin';
import type { BuyInRow, CashoutRow, OrderRow, PlayerRow } from '@/lib/supabase/queries';

const ACTION = 'flex-1 h-11 text-xs tracking-widest uppercase';

interface MergePanelProps {
  player: PlayerRow;
  players: PlayerRow[];
  balanceCents: number;
  ledger: { orders: OrderRow[]; buyIns: BuyInRow[]; cashouts: CashoutRow[] };
  confirm: ConfirmApi['confirm'];
}

// players.archived_at is 0014's; before it is applied the key is absent, which reads as active.
function archived(p: PlayerRow): boolean {
  return isPlayerArchived(p);
}

function SurvivorPicker({ options, onPick }: { options: PlayerRow[]; onPick: (p: PlayerRow) => void }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = options.filter((p) => p.name.toLowerCase().includes(needle));
  return (
    <div className='space-y-2'>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className='h-11'
        placeholder='Search players'
        aria-label='Search players to merge into'
        autoFocus
      />
      <ul className='max-h-64 overflow-y-auto border border-border rounded-md divide-y divide-border'>
        {matches.map((p) => (
          <li key={p.id}>
            <button type='button' onClick={() => onPick(p)} className='w-full min-h-11 px-3 text-left text-sm hover:bg-accent/10'>
              {p.name}
              {archived(p) && <span className='text-xs text-muted-foreground'> · archived</span>}
            </button>
          </li>
        ))}
        {!matches.length && <li className='px-3 py-3 text-xs text-muted-foreground'>No player by that name</li>}
      </ul>
    </div>
  );
}

function BalanceRow({ label, cents }: { label: string; cents: number | undefined }) {
  return (
    <div className='flex justify-between gap-3 text-sm'>
      <span className='truncate'>{label}</span>
      <span className='shrink-0 tabular-nums text-muted-foreground'>{cents === undefined ? '…' : describeBalance(cents)}</span>
    </div>
  );
}

/** "Merge into another player…": fold a duplicate row into the one that stays (0014). */
export function MergePlayerPanel({ player, players, balanceCents, ledger, confirm }: MergePanelProps) {
  const [open, setOpen] = useState(false);
  const merge = useMergePlayer(player, ledger, confirm);
  const others = players.filter((p) => p.id !== player.id && p.bar_id === player.bar_id);
  const combined = merge.intoBalanceCents === undefined ? undefined : balanceCents + merge.intoBalanceCents;

  function close() {
    setOpen(false);
    merge.choose(undefined);
  }

  if (!others.length) return null;
  if (!open) {
    return (
      <Button variant='outline' className='w-full h-11 text-xs tracking-widest uppercase' onClick={() => setOpen(true)}>
        Merge into another player…
      </Button>
    );
  }
  return (
    <div className='space-y-3'>
      <p className='text-xs text-muted-foreground'>
        Pick the player who stays. {player.name}&apos;s games and payments move to them, and {player.name} is removed.
      </p>
      {merge.into ? (
        <div className='space-y-2 border border-border rounded-md p-3'>
          <BalanceRow label={player.name} cents={balanceCents} />
          <BalanceRow label={merge.into.name} cents={merge.intoBalanceCents} />
          <div className='border-t border-border pt-2 font-medium'>
            <BalanceRow label={`${merge.into.name} after`} cents={combined} />
          </div>
        </div>
      ) : (
        <SurvivorPicker options={others} onPick={merge.choose} />
      )}
      {merge.refusal && <p role='alert' className='text-sm text-destructive'>{merge.refusal}</p>}
      <div className='flex gap-2'>
        <Button variant='outline' className={ACTION} disabled={merge.merging} onClick={merge.into ? () => merge.choose(undefined) : close}>
          {merge.into ? 'Back' : 'Cancel'}
        </Button>
        {merge.into && (
          <Button variant='destructive' className={ACTION} disabled={merge.merging || combined === undefined} onClick={() => void merge.merge()}>
            {merge.merging ? 'Merging…' : 'Merge'}
          </Button>
        )}
      </div>
    </div>
  );
}

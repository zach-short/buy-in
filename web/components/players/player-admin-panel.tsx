import { useState } from 'react';
import { toast } from 'sonner';
import { Archive, ArchiveRestore } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MergePlayerPanel } from '@/components/players/merge-player-panel';
import type { ConfirmApi } from '@/hooks/use-confirm';
import { isPlayerArchived, setPlayerArchived } from '@/lib/supabase/player-admin';
import type { BuyInRow, CashoutRow, OrderRow, PlayerRow } from '@/lib/supabase/queries';

interface AdminPanelProps {
  player: PlayerRow;
  players: PlayerRow[];
  balanceCents: number;
  ledger: { orders: OrderRow[]; buyIns: BuyInRow[]; cashouts: CashoutRow[] };
  confirm: ConfirmApi['confirm'];
  onRosterChanged: () => void;
}

// Archive only hides the row from the host's list (0014 header); nothing about money changes,
// so it takes no confirmation and undoes with one tap.
function ArchiveToggle({ player, onChanged }: { player: PlayerRow; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  // players.archived_at is 0014's; before it is applied the key is absent, which reads as active.
  const archived = isPlayerArchived(player);

  async function toggle() {
    setSaving(true);
    try {
      await setPlayerArchived(player.id, !archived);
      toast.success(archived ? `${player.name} restored` : `${player.name} archived`);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='flex items-center justify-between gap-3'>
      <p className='text-xs text-muted-foreground'>
        {archived ? 'Archived: hidden' : 'Archiving hides them'} from the players list. Balance still counts.
      </p>
      <Button variant='outline' className='h-11 shrink-0 text-xs tracking-widest uppercase' disabled={saving} onClick={() => void toggle()}>
        {archived ? <ArchiveRestore aria-hidden='true' /> : <Archive aria-hidden='true' />}
        {archived ? 'Restore' : 'Archive'}
      </Button>
    </div>
  );
}

/** Tidying the roster: archive a player who stopped coming, or merge a duplicate row away. */
export function PlayerAdminPanel({ player, players, balanceCents, ledger, confirm, onRosterChanged }: AdminPanelProps) {
  return (
    <div className='border border-border rounded-md p-4 mb-8 space-y-4'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>Roster</p>
      <ArchiveToggle player={player} onChanged={onRosterChanged} />
      <MergePlayerPanel player={player} players={players} balanceCents={balanceCents} ledger={ledger} confirm={confirm} />
    </div>
  );
}

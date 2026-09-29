import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';

import type { ConfirmApi } from '@/hooks/use-confirm';
import { playerBalanceCents } from '@/lib/ledger';
import { copyText } from '@/lib/share';
import { mergePlayers } from '@/lib/supabase/player-admin';
import { fetchPlayerPayments, type BuyInRow, type CashoutRow, type OrderRow, type PlayerRow } from '@/lib/supabase/queries';
import { portalUrl, shareToken } from '@/lib/supabase/share-links';

interface BarLedger {
  orders: OrderRow[];
  buyIns: BuyInRow[];
  cashouts: CashoutRow[];
}

export interface MergePlayerApi {
  into: PlayerRow | undefined;
  choose: (player: PlayerRow | undefined) => void;
  /** The survivor's balance today; undefined until their payments have loaded. */
  intoBalanceCents: number | undefined;
  merging: boolean;
  /** The database's refusal, word for word as player-admin.ts words it. */
  refusal: string | null;
  merge: () => Promise<void>;
}

/**
 * Folds `from` into a chosen survivor through 0014's merge_players. The database moves every
 * ledger row and checks that the survivor's balance afterwards is the sum of both; this only
 * shows the host that sum first and asks them to type the survivor's name.
 */
async function copySurvivorPortal(player: PlayerRow) {
  try {
    if (await copyText(portalUrl(await shareToken(player, null))) === 'failed') throw new Error("Couldn't copy the link");
    toast.success('Portal link copied');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

export function useMergePlayer(from: PlayerRow, ledger: BarLedger, confirm: ConfirmApi['confirm']): MergePlayerApi {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [into, setInto] = useState<PlayerRow | undefined>();
  const [merging, setMerging] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // The page only loads this player's payments; the survivor's balance needs theirs too.
  const { data: intoPayments } = useSWR(into ? ['payments', into.id] : null, ([, id]) => fetchPlayerPayments(id));
  const intoBalanceCents = into && intoPayments
    ? playerBalanceCents(into.id, ledger.orders, ledger.buyIns, ledger.cashouts, intoPayments)
    : undefined;

  function choose(player: PlayerRow | undefined) {
    setInto(player);
    setRefusal(null);
  }

  async function merge() {
    if (!into || merging) return;
    const ok = await confirm({
      title: `Merge ${from.name} into ${into.name}?`,
      description: `Every game, drink, buy-in, cash-out, payment and payment report of ${from.name} moves to ${into.name}, and ${from.name} is deleted. ${from.name}'s portal link will stop working — send ${into.name} a new link. This cannot be undone.`,
      confirmLabel: 'Merge',
      destructive: true,
      requireText: into.name,
    });
    if (!ok) return;
    setMerging(true);
    setRefusal(null);
    try {
      await mergePlayers(from.id, into.id);
      const survivor = into;
      // merge_players deletes the merged-away row's share links, so whoever used that portal
      // needs the survivor's; offer it right here rather than leaving the host to find it.
      toast.success(`Merged into ${survivor.name}`, {
        duration: 10_000,
        action: { label: 'Copy portal link', onClick: () => void copySurvivorPortal(survivor) },
      });
      router.replace(`/players/${into.id}`);
      // Every ledger row of `from` now carries the survivor's id, and `from` is gone.
      for (const key of ['players', 'sessions', 'orders', 'buy_ins', 'cashouts']) void mutate(key);
      void mutate(['payments', into.id]);
    } catch (e) {
      setRefusal((e as Error).message);
      setMerging(false);
      // A merge whose answer was lost may still have happened; the roster says which.
      void mutate('players');
    }
  }

  return { into, choose, intoBalanceCents, merging, refusal, merge };
}

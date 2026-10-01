import { toast } from 'sonner';

import type { ConfirmApi } from '@/hooks/use-confirm';
import { copyText, shareOrCopy, smsHref } from '@/lib/share';
import type { PlayerRow } from '@/lib/supabase/queries';
import { portalUrl, replacePortalToken, shareToken } from '@/lib/supabase/share-links';

type LinkPlayer = Pick<PlayerRow, 'id' | 'bar_id' | 'name' | 'phone'>;

export interface PlayerLinksApi {
  copyPortalLink: (replace: boolean) => Promise<void>;
  requestReceipt: () => Promise<void>;
  /** Texts (with a phone) or shares the portal link, bare. Only for a positive balance. */
  remind: (balanceCents: number) => Promise<void>;
}

function reportShare(result: Awaited<ReturnType<typeof shareOrCopy>>, copied: string) {
  if (result === 'copied') toast.success(copied);
  else if (result === 'failed') toast.error("Couldn't share or copy the link");
}

/** The one link a host sends a player: their portal, copied, texted or shared. */
export function usePlayerLinks(player: LinkPlayer | undefined, confirm: ConfirmApi['confirm']): PlayerLinksApi {
  async function copyPortalLink(replace: boolean) {
    if (!player) return;
    // Replacing revokes every portal link this player holds — the ones already texted stop
    // working (D8's revocability, owner's answer 2026-09-27).
    if (replace && !(await confirm({
      title: `Replace ${player.name}'s portal link?`,
      description: 'The old one stops working.',
      confirmLabel: 'Replace',
      destructive: true,
    }))) return;
    try {
      const token = replace ? await replacePortalToken(player) : await shareToken(player, null);
      if (await copyText(portalUrl(token)) === 'failed') throw new Error("Couldn't copy the link");
      toast.success(replace ? 'New portal link copied' : 'Portal link copied');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function requestReceipt() {
    if (!player?.phone) return;
    try {
      const url = portalUrl(await shareToken(player, null));
      window.location.href = smsHref(player.phone, url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // The portal is the page with the pay buttons and the "I sent it" report. requestReceipt sends
  // the same link (owner, 2026-09-30: /player-receipt redirects there) with no balance check.
  async function remind(balanceCents: number) {
    if (!player || balanceCents <= 0) return;
    try {
      const url = portalUrl(await shareToken(player, null));
      if (player.phone) window.location.href = smsHref(player.phone, url);
      else reportShare(await shareOrCopy(url), 'Reminder link copied');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return { copyPortalLink, requestReceipt, remind };
}

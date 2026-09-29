import { toast } from 'sonner';

import { shareOrCopy, smsHref } from '@/lib/share';
import type { PlayerRow } from '@/lib/supabase/queries';
import { receiptUrl, shareToken } from '@/lib/supabase/share-links';

/**
 * Send a player this night's receipt: a session-scoped link (D15), reused if one is live, so
 * sending twice sends one link. A text when the player has a phone, else the share sheet or
 * the clipboard. Resolves true once the text or share was handed off.
 */
export async function sendReceipt(player: Pick<PlayerRow, 'id' | 'bar_id' | 'name' | 'phone'>, sessionId: string): Promise<boolean> {
  let url: string;
  try {
    url = receiptUrl(await shareToken(player, sessionId));
  } catch (e) {
    toast.error((e as Error).message);
    return false;
  }
  if (player.phone) {
    window.location.href = smsHref(player.phone, url);
    return true;
  }
  const result = await shareOrCopy({ url, title: `${player.name}'s receipt` });
  if (result === 'copied') toast.success('Receipt link copied');
  if (result === 'failed') toast.error('Could not share the receipt link');
  return result === 'shared' || result === 'copied';
}

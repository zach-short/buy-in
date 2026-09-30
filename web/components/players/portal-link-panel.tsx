import { Link2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PlayerLinksApi } from '@/components/players/use-player-links';

const LABEL = 'text-xs tracking-widest uppercase text-muted-foreground';
const ACTION = 'flex-1 h-11 text-xs tracking-wider uppercase';

/**
 * The player's portal: their own page with the balance, the pay buttons and "I sent it". These
 * sat in the header as "Portal" and "New link", where neither said what it did or that the
 * second one revokes every portal link already sent (replacePortalToken, share-links.ts; the
 * confirm lives in usePlayerLinks). Session receipt links are not touched by a reset.
 */
export function PortalLinkPanel({ links }: { links: PlayerLinksApi }) {
  return (
    <div className='border border-border rounded-md p-4 mb-8 space-y-3'>
      <div className='space-y-1'>
        <p className={LABEL}>Portal link</p>
        <p className='text-xs text-muted-foreground'>Their own page: balance, history and pay buttons. No login needed.</p>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button variant='outline' className={ACTION} onClick={() => void links.copyPortalLink(false)}>
          <Link2 aria-hidden='true' />
          Copy portal link
        </Button>
        <Button variant='outline' className={ACTION} onClick={() => void links.copyPortalLink(true)}>
          <RotateCcw aria-hidden='true' />
          Reset portal link
        </Button>
      </div>
      <p className='text-xs text-muted-foreground'>Reset makes a new link. Every portal link you already sent stops working.</p>
    </div>
  );
}

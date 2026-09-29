import { toast } from 'sonner';

import { copyText } from '@/lib/share';
import type { InventoryRow } from '@/lib/supabase/queries';
import { formatQty, isRunningLow, shoppingListText, suggestedBuy } from './stock';

/** The shopping list: every tracked item at or below its reorder point. Renders nothing when none are. */
export function RunningLow({ items }: { items: InventoryRow[] }) {
  const low = items.filter(isRunningLow);
  if (!low.length) return null;

  async function copyList() {
    const result = await copyText(shoppingListText(low));
    if (result === 'copied') toast.success('List copied');
    else toast.error("Couldn't copy — try again");
  }

  return (
    <section className='mb-8'>
      <div className='flex items-center justify-between mb-3'>
        <p className='text-xs tracking-widest uppercase text-destructive'>Running low</p>
        <button
          type='button'
          onClick={copyList}
          className='-my-3 py-3 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
        >
          Copy list
        </button>
      </div>
      <div className='border border-border rounded-md divide-y divide-border'>
        {low.map((item) => (
          <div key={item.id} className='flex items-center justify-between gap-3 px-4 py-3 min-h-[52px] text-sm'>
            <div className='min-w-0'>
              <p className='truncate'>{item.name}</p>
              <p className='text-xs text-muted-foreground tabular-nums'>
                {formatQty(item.qty_on_hand)} {item.unit} on hand · reorder at {formatQty(item.reorder_threshold)}
              </p>
            </div>
            <span className='shrink-0 tabular-nums'>
              Buy {formatQty(suggestedBuy(item))} {item.unit}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

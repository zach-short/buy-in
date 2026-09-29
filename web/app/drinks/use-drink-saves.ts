import { toast } from 'sonner';

import { createSimpleDrink } from '@/lib/supabase/drink-setup';
import { setDrinkArchived } from '@/lib/supabase/drink-stock';
import type { DrinkWithIngredients, InventoryRow } from '@/lib/supabase/queries';
import { saveDrink } from '@/lib/supabase/writes';
import { buildDrink, buildSimpleDrink, type DrinkForm } from './drink-form';

interface DrinkSaveOptions {
  inventory: InventoryRow[];
  /** Revalidates drinks and inventory; a tracked-stock drink adds an inventory item too. */
  refresh: () => void;
  onCreated: () => void;
  onUpdated: () => void;
}

async function attempt(write: () => Promise<void>, success: string, after: () => void): Promise<void> {
  try {
    await write();
    toast.success(success);
    after();
  } catch (e) {
    toast.error((e as Error).message);
  }
}

/** The drinks page's three writes, each toasting its own outcome. */
export function useDrinkSaves({ inventory, refresh, onCreated, onUpdated }: DrinkSaveOptions) {
  function create(form: DrinkForm): Promise<void> {
    // A failed simple-drink create may still have added its item; refresh shows it either way.
    const write = form.trackStock
      ? () => createSimpleDrink(buildSimpleDrink(form)).finally(refresh)
      : () => saveDrink(buildDrink(form, inventory));
    return attempt(write, 'Drink created', () => { onCreated(); refresh(); });
  }

  function update(drink: DrinkWithIngredients, form: DrinkForm): Promise<void> {
    return attempt(() => saveDrink(buildDrink(form, inventory), drink.id), 'Drink updated', () => { onUpdated(); refresh(); });
  }

  function setArchived(drink: DrinkWithIngredients, archived: boolean): Promise<void> {
    const message = archived ? `${drink.name} archived` : `${drink.name} restored`;
    return attempt(() => setDrinkArchived(drink.id, archived), message, () => { onUpdated(); refresh(); });
  }

  return { create, update, setArchived };
}

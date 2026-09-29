'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { useBarFeatures } from '@/hooks/use-bar-features';
import { useConfirm } from '@/hooks/use-confirm';

// Copy chosen by the owner 2026-09-29, warm register (R7).
function ordersWarning(count: number): string {
  const drinks = count === 1 ? 'The 1 drink already on a tab' : `The ${count} drinks already on tabs`;
  return `You can switch drinks off any time. ${drinks} will still count toward what people owe.`;
}

export function HostFeaturesSetting() {
  const { settings, isLoading, error, setServesDrinks, setTracksInventory, countOrders } = useBarFeatures();
  const { confirm, confirmDialog } = useConfirm();
  const [saving, setSaving] = useState(false);

  async function run(write: () => Promise<void>) {
    setSaving(true);
    try {
      await write();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Turning drinks off is allowed with orders present (SCOPE.md §7 Q4); the host is told
  // those drinks still count, because hiding them never takes them off anyone's balance.
  async function confirmDrinksOff(): Promise<boolean> {
    try {
      const count = await countOrders();
      return count === 0 || await confirm({
        title: 'Turn drinks off?',
        description: ordersWarning(count),
        confirmLabel: 'Turn off',
        cancelLabel: 'Keep on',
      });
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  }

  async function toggleDrinks(on: boolean) {
    if (!on && !(await confirmDrinksOff())) return;
    await run(() => setServesDrinks(on));
  }

  if (error) {
    return <p className='text-xs text-destructive mb-6'>Couldn&apos;t load your drinks settings: {error.message}</p>;
  }

  return (
    <div className='border border-border rounded-md p-4 mb-6 space-y-4'>
      <p className='text-xs tracking-widest uppercase text-muted-foreground'>Track drinks</p>
      {isLoading || !settings ? (
        <p className='text-xs text-muted-foreground'>Loading…</p>
      ) : !settings.drinksAllowed ? (
        // BD-7: the owner's gate. One neutral line — no request button and no reason given.
        <p className='text-xs text-muted-foreground'>Drink tracking isn&apos;t available on this table.</p>
      ) : (
        <>
          {/* Copy set by the owner in the BD-7 amendment (PASSOFF.md item 18), 2026-09-29. */}
          <p className='text-xs text-muted-foreground'>
            Log what everyone has at the table so you can split the bar fairly afterward. Buy-In only keeps the
            tally. It doesn&apos;t collect money, and it isn&apos;t a way to sell drinks. Settle up with your friends
            yourselves, and keep it a shared cost, not a per-drink sale. You&apos;re responsible for following local
            alcohol laws, including age limits. Don&apos;t log drinks for anyone under the legal drinking age.
          </p>
          <SwitchRow
            id='serves-drinks'
            label='I serve drinks'
            helper='Drinks, the menu and stats. Switch off for a game with no bar.'
            checked={settings.servesDrinks}
            disabled={saving}
            onChange={toggleDrinks}
          />
          <SwitchRow
            id='tracks-inventory'
            label='Track inventory'
            helper='Count bottles as drinks are poured.'
            checked={settings.tracksInventory}
            disabled={saving || !settings.servesDrinks}
            onChange={(on) => run(() => setTracksInventory(on))}
          />
        </>
      )}
      {confirmDialog}
    </div>
  );
}

interface SwitchRowProps {
  id: string;
  label: string;
  helper: string;
  checked: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}

// No Radix switch is installed; a button with role="switch" is the accessible native shape.
function SwitchRow({ id, label, helper, checked, disabled, onChange }: SwitchRowProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className='space-y-1'>
        <label htmlFor={id} className='text-sm'>{label}</label>
        <p className='text-xs text-muted-foreground'>{helper}</p>
      </div>
      <button
        id={id}
        type='button'
        role='switch'
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <span
          className={`inline-block size-4 rounded-full bg-foreground transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}

import { Button } from '@/components/ui/button';
import type { PaymentMode } from '@/components/players/record-payment-form';

const ACTION = 'h-11 min-w-0 px-2 text-xs tracking-wider uppercase';

interface PaymentActionsProps {
  balanceCents: number;
  hasPhone: boolean;
  /** Shown only when the house owes the player and they have a Venmo handle. */
  canPayVenmo: boolean;
  onRecord: (mode: PaymentMode) => void;
  onPayVenmo: () => void;
  onRemind: () => void;
  onRequest: () => void;
}

/**
 * The host's payment actions for one player. The direction the balance points decides which
 * record button carries the gold border: a player who owes (> 0) is most likely paying the host,
 * a player owed (< 0) is being paid. Remind and Request are secondary, grey like every outline.
 * Two columns rather than three so the labels fit at 375px.
 */
export function PaymentActions({
  balanceCents, hasPhone, canPayVenmo, onRecord, onPayVenmo, onRemind, onRequest,
}: PaymentActionsProps) {
  return (
    <div className='space-y-3 mb-8'>
      <div className='grid grid-cols-2 gap-3'>
        <Button variant={balanceCents > 0 ? 'default' : 'outline'} className={ACTION} onClick={() => onRecord('received')}>
          They Paid Me
        </Button>
        <Button variant={balanceCents < 0 ? 'default' : 'outline'} className={ACTION} onClick={() => onRecord('sent')}>
          I Paid Them
        </Button>
      </div>
      {canPayVenmo && (
        <button
          type='button'
          onClick={onPayVenmo}
          className='w-full min-h-11 py-3 rounded text-xs tracking-widest uppercase font-semibold text-white transition-opacity hover:opacity-90'
          style={{ background: '#3D95CE' }}
        >
          Pay
        </button>
      )}
      {balanceCents > 0 && (
        <Button variant='outline' className={`w-full ${ACTION}`} onClick={onRemind}>
          {hasPhone ? 'Remind · Text' : 'Remind · Share'}
        </Button>
      )}
      {hasPhone && (
        <Button variant='outline' className={`w-full ${ACTION}`} onClick={onRequest}>
          Request · Text Full History
        </Button>
      )}
    </div>
  );
}

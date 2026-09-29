'use client';

import { Trash2 } from 'lucide-react';
import { formatCents, formatTime } from '@pb/core';

import type { OrderRow } from '@/lib/supabase/queries';
import { cn } from '@/lib/utils';

interface OrderListProps {
  /** The selected player's orders, newest first. */
  orders: readonly OrderRow[];
  paid: boolean;
  onUndo: (order: OrderRow) => void;
  onTogglePaid: () => void;
}

export function OrderList({ orders, paid, onUndo, onTogglePaid }: OrderListProps) {
  return (
    <>
      <div className='flex-1 px-6 py-4 pb-32'>
        {orders.length === 0 ? (
          <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>No orders yet</p>
        ) : (
          <div className='divide-y divide-border border border-border rounded-md'>
            {orders.map((order) => (
              <div key={order.id} className='flex items-center justify-between px-4 py-1 min-h-[52px]'>
                <div className='min-w-0'>
                  <p className='text-sm'>{order.drink_name}</p>
                  <p className='text-xs text-muted-foreground'>{formatTime(order.created_at)}</p>
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                  <span className='text-sm font-semibold text-primary tabular-nums'>${formatCents(order.price_cents)}</span>
                  {!order.id.startsWith('temp-') && (
                    <button
                      type='button'
                      aria-label={`Remove ${order.drink_name}`}
                      onClick={() => onUndo(order)}
                      className='size-11 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors'
                    >
                      <Trash2 className='size-3.5' />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {orders.length > 0 && (
        <div className='px-6 pb-6'>
          <button
            type='button'
            onClick={onTogglePaid}
            className={cn(
              'w-full h-11 rounded border text-xs tracking-widest uppercase font-medium transition-colors',
              paid
                ? 'border-green-500/50 text-green-500 hover:border-green-500'
                : 'border-border text-muted-foreground hover:border-primary hover:text-primary',
            )}
          >
            {paid ? '✓ Paid — Mark Unpaid' : 'Mark Paid'}
          </button>
        </div>
      )}
    </>
  );
}

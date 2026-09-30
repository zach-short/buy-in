import Link from 'next/link';

// One full-page note for Loading / error / not-found, replacing the `min-h-screen flex
// items-center justify-center text-muted-foreground …` div pasted into each route. Same look
// as data-state.tsx (uppercase, wide tracking, destructive text for errors); DataState stays
// the in-page version for list screens.

type StatusKind = 'loading' | 'error' | 'empty';

type StatusAction = { label: string } & ({ onClick: () => void; href?: never } | { href: string; onClick?: never });

interface StatusScreenProps {
  kind: StatusKind;
  title?: string;
  message?: string;
  action?: StatusAction;
  /** A quieter way out under the primary action, e.g. "Home" beside "Retry". */
  secondaryAction?: StatusAction;
}

const DEFAULT_TITLE: Record<StatusKind, string> = {
  loading: 'Loading…',
  error: 'Something went wrong',
  empty: 'Nothing here',
};

const ACTION_CLASS = 'text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors';
// Dimmer than the primary so the eye lands on the primary first; min-h-11 keeps a 44px tap
// target, since the secondary is the way out when the primary does not help.
const SECONDARY_ACTION_CLASS =
  'inline-flex min-h-11 items-center px-4 text-xs tracking-widest uppercase text-muted-foreground/70 hover:text-foreground transition-colors';

// A loading screen announces politely; an error interrupts. `empty` is a static note, so it
// gets no live-region role.
function liveRegion(kind: StatusKind) {
  if (kind === 'loading') return { role: 'status', 'aria-live': 'polite' } as const;
  if (kind === 'error') return { role: 'alert' } as const;
  return {};
}

export function StatusScreen({ kind, title = DEFAULT_TITLE[kind], message, action, secondaryAction }: StatusScreenProps) {
  const titleColor = kind === 'error' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className='min-h-dvh flex items-center justify-center px-6' {...liveRegion(kind)}>
      <div className='text-center space-y-3'>
        <p className={`text-sm tracking-widest ${titleColor}`}>{title}</p>
        {message && <p className='text-xs text-muted-foreground'>{message}</p>}
        {action && <ActionControl action={action} className={ACTION_CLASS} />}
        {secondaryAction && (
          <div>
            <ActionControl action={secondaryAction} className={SECONDARY_ACTION_CLASS} />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionControl({ action, className }: { action: StatusAction; className: string }) {
  if (action.href !== undefined) {
    return <Link href={action.href} className={className}>{action.label}</Link>;
  }
  return <button type='button' onClick={action.onClick} className={className}>{action.label}</button>;
}

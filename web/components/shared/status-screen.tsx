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
}

const DEFAULT_TITLE: Record<StatusKind, string> = {
  loading: 'Loading…',
  error: 'Something went wrong',
  empty: 'Nothing here',
};

const ACTION_CLASS = 'text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors';

// A loading screen announces politely; an error interrupts. `empty` is a static note, so it
// gets no live-region role.
function liveRegion(kind: StatusKind) {
  if (kind === 'loading') return { role: 'status', 'aria-live': 'polite' } as const;
  if (kind === 'error') return { role: 'alert' } as const;
  return {};
}

export function StatusScreen({ kind, title = DEFAULT_TITLE[kind], message, action }: StatusScreenProps) {
  const titleColor = kind === 'error' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className='min-h-dvh flex items-center justify-center px-6' {...liveRegion(kind)}>
      <div className='text-center space-y-3'>
        <p className={`text-sm tracking-widest ${titleColor}`}>{title}</p>
        {message && <p className='text-xs text-muted-foreground'>{message}</p>}
        {action && <ActionControl action={action} />}
      </div>
    </div>
  );
}

function ActionControl({ action }: { action: StatusAction }) {
  if (action.href !== undefined) {
    return <Link href={action.href} className={ACTION_CLASS}>{action.label}</Link>;
  }
  return <button type='button' onClick={action.onClick} className={ACTION_CLASS}>{action.label}</button>;
}

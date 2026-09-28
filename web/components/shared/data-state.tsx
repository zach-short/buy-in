import type { ReactNode } from 'react';

// D2 (docs/conventions-typescript.md): loading, error and empty render through this one
// component, so a list screen cannot ship with only some of them. The empty state is a
// required prop because it is the one that gets skipped, and the one a new host sees first.

interface DataStateProps<Row> {
  /** SWR's `data`: undefined until the first load settles. */
  rows: Row[] | undefined;
  error: Error | undefined;
  /** The app's SWRConfig turns off retry-on-error, and an installed PWA has no reload button. */
  onRetry: () => void;
  empty: ReactNode;
  children: (rows: Row[]) => ReactNode;
}

const NOTE = 'text-center text-xs tracking-widest uppercase py-12';

// Rows already on screen win over a failed revalidation: stale rows are more use to a host
// mid-game than an error replacing them.
export function DataState<Row>({ rows, error, onRetry, empty, children }: DataStateProps<Row>) {
  if (rows === undefined && error) return <ErrorNote message={error.message} onRetry={onRetry} />;
  if (rows === undefined) return <p className={`${NOTE} text-muted-foreground`}>Loading…</p>;
  if (rows.length === 0) return <>{empty}</>;
  return <>{children(rows)}</>;
}

function ErrorNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={`${NOTE} space-y-3`}>
      <p className='text-destructive normal-case tracking-normal'>{message}</p>
      <button onClick={onRetry} className='text-muted-foreground hover:text-foreground transition-colors'>
        Retry
      </button>
    </div>
  );
}

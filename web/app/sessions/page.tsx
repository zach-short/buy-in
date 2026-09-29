'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { formatDate } from '@pb/core';
import { DataState } from '@/components/shared/data-state';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/use-confirm';
import { fetchPlayers, fetchSessions, type SessionWithPlayers } from '@/lib/supabase/queries';
import { deleteSession } from '@/lib/supabase/writes';

// "Unsettled" is deliberately absent: telling it needs every order, buy-in, cash-out and
// payment in the bar, four full paged reads this list does not otherwise make.
type SessionFilter = 'all' | 'active' | 'closed';

const FILTERS: { value: SessionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
];

function matchesFilter(session: SessionWithPlayers, filter: SessionFilter): boolean {
  return filter === 'all' || session.status === filter;
}

export default function SessionsPage() {
  const router = useRouter();
  const { data: sessions, error, mutate } = useSWR<SessionWithPlayers[], Error>('sessions', fetchSessions);
  const { data: players = [] } = useSWR('players', fetchPlayers);
  const { confirm, confirmDialog } = useConfirm();

  const [filter, setFilter] = useState<SessionFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const playerMap = new Map(players.map((p) => [p.id, p.name]));

  function handleClick(s: SessionWithPlayers) {
    router.push(s.status === 'active' ? `/session/${s.id}` : `/session/${s.id}/summary`);
  }

  // The typed name is a guard against a slip, not access control: delete_session (0002) is
  // what decides, and it refuses any session that still has drink orders.
  async function requestDelete(session: SessionWithPlayers) {
    const ok = await confirm({
      title: 'Delete this session?',
      description: 'Its buy-ins and cash-outs are removed for good. A session with drink orders cannot be deleted — undo those first.',
      confirmLabel: 'Delete',
      destructive: true,
      requireText: session.name.trim() || 'delete',
    });
    if (!ok) return;
    setDeletingId(session.id);
    try {
      await deleteSession(session.id);
      await mutate();
      toast.success('Session deleted');
    } catch (e) {
      toast.error("Couldn't delete session", { description: (e as Error).message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <PageMain>
      <PageHeader title='Sessions' subtitle={sessions ? `${sessions.length} total` : undefined} />

      <DataState rows={sessions} error={error} onRetry={() => void mutate()} empty={<NoSessions />}>
        {(rows) => {
          const visible = rows.filter((s) => matchesFilter(s, filter));
          return (
            <>
              <FilterBar value={filter} onChange={setFilter} />
              {visible.length === 0 && (
                <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>No {filter} sessions</p>
              )}
              <div className='space-y-3'>
                {visible.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    names={session.player_ids.map((id) => playerMap.get(id)).filter((n): n is string => !!n)}
                    deleting={deletingId === session.id}
                    onOpen={() => handleClick(session)}
                    onDelete={() => void requestDelete(session)}
                  />
                ))}
              </div>
            </>
          );
        }}
      </DataState>

      {confirmDialog}
    </PageMain>
  );
}

function FilterBar({ value, onChange }: { value: SessionFilter; onChange: (next: SessionFilter) => void }) {
  return (
    <div className='flex gap-2 mb-4'>
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type='button'
          aria-pressed={value === f.value}
          onClick={() => onChange(f.value)}
          className={`h-11 px-4 rounded-full border text-xs tracking-widest uppercase transition-colors ${
            value === f.value ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

interface SessionRowProps {
  session: SessionWithPlayers;
  names: string[];
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

// The delete control is a sibling of the row's button, not an overlay revealed on hover:
// touch screens have no hover, and a hidden control there was unreachable.
function SessionRow({ session, names, deleting, onOpen, onDelete }: SessionRowProps) {
  return (
    <div className='flex items-stretch border border-border rounded-md hover:border-primary/50 transition-colors'>
      <button onClick={onOpen} className='flex-1 min-w-0 text-left pl-4 pr-2 py-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-sm font-medium truncate'>{session.name}</p>
            <p className='text-xs text-muted-foreground mt-0.5'>{formatDate(session.played_on)}</p>
            {names.length > 0 && (
              <p className='text-xs text-muted-foreground mt-1 truncate'>{names.join(', ')}</p>
            )}
          </div>
          <span
            className={`shrink-0 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded border mt-0.5 ${
              session.status === 'active'
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            {session.status}
          </span>
        </div>
      </button>
      <button
        type='button'
        onClick={onDelete}
        disabled={deleting}
        aria-label={`Delete session ${session.name}`}
        className='shrink-0 w-11 min-h-11 mr-1 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40'
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function NoSessions() {
  return (
    <div className='text-center py-12 space-y-4'>
      <p className='text-muted-foreground text-xs tracking-widest uppercase'>No sessions yet</p>
      <Button asChild className='h-11 px-6 text-xs tracking-widest uppercase'>
        <Link href='/session/new'><Plus aria-hidden='true' /> Start a session</Link>
      </Button>
    </div>
  );
}

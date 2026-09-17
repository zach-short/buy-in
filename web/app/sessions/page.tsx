'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, apiFetch, formatDate, Session, Player } from '@/lib/bar-api';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// SHA-256 of the delete passcode — plaintext never stored here
const PASSCODE_HASH = 'e56975e864a626b52ec07ff2d4fc370f047c5f286a67f1bec49fc19eef5c40b4';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function SessionsPage() {
  const router = useRouter();
  const { data: sessions = [], isLoading, mutate } = useSWR<Session[]>('/api/sessions', fetcher);
  const { data: players = [] } = useSWR<Player[]>('/api/players', fetcher);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const playerMap = new Map(players.map((p) => [p.id, p.name]));
  const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  function handleClick(s: Session) {
    router.push(s.status === 'active' ? `/session/${s.id}` : `/session/${s.id}/summary`);
  }

  function openDelete(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation();
    setPendingDeleteId(sessionId);
    setPasscode('');
    setPasscodeError(false);
  }

  function cancelDelete() {
    setPendingDeleteId(null);
    setPasscode('');
    setPasscodeError(false);
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const hash = await sha256(passcode);
    if (hash !== PASSCODE_HASH) {
      setPasscodeError(true);
      setPasscode('');
      return;
    }
    setDeleting(true);
    try {
      await apiFetch(`/api/sessions/${pendingDeleteId}`, { method: 'DELETE' });
      await mutate();
      toast.success('Session deleted');
      setPendingDeleteId(null);
      setPasscode('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className='min-h-screen px-6 py-10 max-w-sm mx-auto'>
      <div className='flex items-center justify-between mb-10'>
        <div>
          <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Sessions</h1>
          <p className='text-xs text-muted-foreground mt-0.5'>{sessions.length} total</p>
        </div>
        <button
          onClick={() => router.back()}
          className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
        >
          Back
        </button>
      </div>

      {isLoading && (
        <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>Loading…</p>
      )}

      {!isLoading && sessions.length === 0 && (
        <p className='text-center text-muted-foreground text-xs tracking-widest uppercase py-12'>No sessions yet</p>
      )}

      <div className='space-y-3'>
        {sorted.map((session) => {
          const names = session.playerIds.map((id) => playerMap.get(id)).filter(Boolean);
          return (
            <div key={session.id} className='relative group'>
              <button
                onClick={() => handleClick(session)}
                className='w-full text-left border border-border rounded-md px-4 py-4 hover:border-primary/50 transition-colors'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium truncate'>{session.name}</p>
                    <p className='text-xs text-muted-foreground mt-0.5'>{formatDate(session.date)}</p>
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
                onClick={(e) => openDelete(e, session.id)}
                className='absolute top-3 right-3 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100'
                title='Delete session'
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {pendingDeleteId && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6'>
          <div className='w-full max-w-sm bg-background border border-border rounded-md p-6 space-y-4'>
            <div>
              <p className='text-sm font-semibold tracking-widest uppercase text-destructive mb-1'>Delete Session</p>
              <p className='text-xs text-muted-foreground'>This will permanently remove the session, all buy-ins, cashouts, and drink orders. Enter the passcode to confirm.</p>
            </div>
            <input
              type='password'
              autoFocus
              placeholder='Passcode'
              value={passcode}
              onChange={(e) => { setPasscode(e.target.value); setPasscodeError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && confirmDelete()}
              className={`w-full h-11 px-3 rounded border bg-background text-sm outline-none transition-colors ${passcodeError ? 'border-destructive text-destructive' : 'border-border focus:border-primary'}`}
            />
            {passcodeError && (
              <p className='text-xs text-destructive -mt-2'>Incorrect passcode</p>
            )}
            <div className='flex gap-3'>
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className='flex-1 h-10 rounded border border-border text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40'
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting || !passcode}
                className='flex-1 h-10 rounded bg-destructive text-destructive-foreground text-xs tracking-widest uppercase font-semibold hover:opacity-90 transition-opacity disabled:opacity-40'
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

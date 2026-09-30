import type { FormEvent } from 'react';
import { Ban, Pencil, RefreshCw, Share2 } from 'lucide-react';

import { formatDate, formatTime, neverExpires, type InviteKind } from '@pb/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInviteCode } from '@/hooks/use-invite-code';
import type { StandingInvite } from '@/lib/supabase/standing-invites';

const SMALL = 'text-xs tracking-widest uppercase';

// Copy is the owner's (R7, the terse set, 2026-09-29).
const TITLE: Record<InviteKind, string> = { link: 'Invite link', code: 'Invite code', both: 'Link + code' };

const NEVER = 'Never expires';

function statusLine({ status, expires_at, revoked_at }: StandingInvite): string {
  if (revoked_at) return `Revoked ${formatDate(revoked_at)}`;
  if (neverExpires(expires_at)) return NEVER;
  // With the time, as the code line has it: a link can now last one hour (0030).
  return `${status === 'live' ? 'Expires' : 'Expired'} ${formatDate(expires_at)}, ${formatTime(expires_at)}`;
}

// A code-only invite has no other date line, so its never reads as the invite's; on a link + code
// invite the word "Code" keeps it apart from the link's line below.
function codeLine({ kind, codeStatus, code_expires_at }: StandingInvite): string {
  if (codeStatus === 'lapsed' || !code_expires_at) return 'Code expired';
  if (neverExpires(code_expires_at)) return kind === 'code' ? NEVER : 'Code never expires';
  return `Code works until ${formatDate(code_expires_at)}, ${formatTime(code_expires_at)}`;
}

interface InviteRowProps {
  invite: StandingInvite;
  revoking: boolean;
  onRevoke: () => void;
  onShare: () => void;
  onChanged: () => Promise<unknown>;
}

export function InviteRow({ invite, revoking, onRevoke, onShare, onChanged }: InviteRowProps) {
  const live = invite.status === 'live';
  return (
    <div className={`border border-border rounded-md px-4 py-3 space-y-2 ${live ? '' : 'opacity-60'}`}>
      <p className='text-sm font-medium'>{TITLE[invite.kind]} · made {formatDate(invite.created_at)}</p>
      {live && invite.codeStatus !== 'none' && <CodeLine invite={invite} onChanged={onChanged} />}
      <div className='flex items-center justify-between gap-3'>
        {/* A code-only invite ends with its code, which CodeLine already dates. */}
        <span className='text-xs text-muted-foreground'>{live && invite.kind === 'code' ? '' : statusLine(invite)}</span>
        {live && (
          <div className='flex gap-2 shrink-0'>
            {invite.kind !== 'code' && (
              <Button variant='outline' size='sm' className={SMALL} onClick={onShare}>
                <Share2 aria-hidden='true' />
                Share
              </Button>
            )}
            <Button variant='outline' size='sm' className={SMALL} onClick={onRevoke} disabled={revoking}>
              <Ban aria-hidden='true' />
              {revoking ? 'Revoking…' : 'Revoke'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// The code, big enough to read out across a table, with rename and a fresh draw (SCOPE A2, A8).
function CodeLine({ invite, onChanged }: { invite: StandingInvite; onChanged: () => Promise<unknown> }) {
  const code = useInviteCode(invite.token, onChanged);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    code.save();
  }

  if (code.editing) {
    return (
      <form onSubmit={handleSubmit} className='flex gap-2'>
        <Input
          value={code.draft}
          onChange={(e) => code.setDraft(e.target.value)}
          aria-label='New code'
          maxLength={8}
          autoComplete='off'
          autoCapitalize='characters'
          spellCheck={false}
          autoFocus
          className='h-9 font-mono uppercase tracking-widest'
        />
        <Button type='submit' size='sm' className={SMALL} disabled={code.busy !== null}>
          {code.busy === 'save' ? 'Saving…' : 'Save'}
        </Button>
        <Button type='button' variant='ghost' size='sm' className={SMALL} onClick={code.cancel}>
          Cancel
        </Button>
      </form>
    );
  }

  const lapsed = invite.codeStatus === 'lapsed';
  return (
    <div className='flex items-center justify-between gap-3'>
      <div>
        <p className={`font-mono text-2xl tracking-[0.3em] ${lapsed ? 'text-muted-foreground line-through' : ''}`}>
          {invite.code ?? '—'}
        </p>
        <p className='text-xs text-muted-foreground'>{codeLine(invite)}</p>
      </div>
      <div className='flex gap-2 shrink-0'>
        {lapsed ? (
          <Button variant='outline' size='sm' className={SMALL} onClick={code.refresh} disabled={code.busy !== null}>
            <RefreshCw aria-hidden='true' />
            {code.busy === 'refresh' ? 'Getting…' : 'New code'}
          </Button>
        ) : (
          <Button variant='outline' size='sm' className={SMALL} onClick={() => code.startEditing(invite.code)}>
            <Pencil aria-hidden='true' />
            Change
          </Button>
        )}
      </div>
    </div>
  );
}

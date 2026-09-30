import { useState } from 'react';
import { RotateCw, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ClaimFlow } from '@/hooks/use-claim-flow';

const ACTION = 'w-full h-11 tracking-widest uppercase text-xs';

// Copy chosen by the owner 2026-09-29 (R7), in the plain register of join-name-form.tsx.

// A short table fits on a screen and a search box would only add a tap; past this many names
// people scroll, so the box appears.
const SEARCH_MIN_NAMES = 8;

function ErrorLine({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p role='alert' className='text-xs text-destructive tracking-wide'>
      {text}
    </p>
  );
}

function Waiting({ name }: { name: string }) {
  return (
    <div className='space-y-3 text-center'>
      <p className='text-sm'>Your host needs to confirm you&apos;re {name || 'that player'}.</p>
      <p className='text-xs text-muted-foreground tracking-wide'>
        This page updates on its own. Nothing to do until then.
      </p>
    </div>
  );
}

function NameList({ claim }: { claim: ClaimFlow }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = claim.players.filter((p) => p.name.toLowerCase().includes(needle));
  return (
    <div className='space-y-2'>
      {claim.players.length >= SEARCH_MIN_NAMES && (
        <Input
          type='search'
          placeholder='Search names'
          aria-label='Search names'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete='off'
          className='h-11'
        />
      )}
      {!shown.length && (
        <p className='text-center text-xs text-muted-foreground tracking-wide'>No one by that name.</p>
      )}
      {shown.map((p) => (
        <Button
          key={p.id}
          variant='outline'
          className='w-full h-11 justify-between text-sm'
          disabled={claim.requesting}
          onClick={() => void claim.pick(p.id)}
        >
          <span>{p.name}</span>
          {claim.requestingId === p.id ? (
            <span className='text-xs text-muted-foreground'>Requesting…</span>
          ) : (
            p.hasPendingRequest && <span className='text-xs text-muted-foreground'>Someone asked</span>
          )}
        </Button>
      ))}
    </div>
  );
}

/** "Pick your name from the table" — the claim step shown after sign-in, before today's name form. */
export function ClaimPicker({ claim }: { claim: ClaimFlow }) {
  if (claim.view === 'waiting') return <Waiting name={claim.waitingFor} />;

  if (claim.view === 'failed') {
    return (
      <div className='space-y-3'>
        <ErrorLine text={claim.error} />
        <Button className={ACTION} onClick={claim.retry}>
          <RotateCw aria-hidden='true' />
          Try again
        </Button>
      </div>
    );
  }

  if (claim.view !== 'picking') {
    return <p className='text-center text-sm text-muted-foreground tracking-widest'>Loading…</p>;
  }

  return (
    <div className='space-y-4'>
      <p className='text-center text-sm'>Pick your name from the table</p>
      {claim.rejectedName && (
        <p className='text-xs text-muted-foreground tracking-wide text-center'>
          Your host didn&apos;t confirm you as {claim.rejectedName}. Pick again, or join as someone new.
        </p>
      )}
      <NameList claim={claim} />
      <ErrorLine text={claim.error} />
      {/* After the list: most people arriving by link are already on it, so their name comes first. */}
      <Button variant='outline' className={ACTION} onClick={claim.chooseNew} disabled={claim.requesting}>
        <UserPlus aria-hidden='true' />
        I&apos;m not on this list
      </Button>
    </div>
  );
}

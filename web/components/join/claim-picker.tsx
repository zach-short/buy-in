import { Button } from '@/components/ui/button';
import type { ClaimFlow } from '@/hooks/use-claim-flow';

const ACTION = 'w-full h-11 tracking-widest uppercase text-xs';

// Every string here is provisional, in the plain register of join-name-form.tsx: the picker
// heading, the waiting state and the rejected note are the owner's to choose (R7, PASSOFF item
// 17 step 6). The build offers variants in its hand-back rather than picking silently.

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
  return (
    <div className='space-y-2'>
      {claim.players.map((p) => (
        <Button
          key={p.id}
          variant='outline'
          className='w-full h-11 justify-between text-sm'
          disabled={claim.requesting}
          onClick={() => void claim.pick(p.id)}
        >
          <span>{p.name}</span>
          {p.hasPendingRequest && <span className='text-xs text-muted-foreground'>Someone asked</span>}
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
      <Button variant='ghost' className={ACTION} onClick={claim.chooseNew} disabled={claim.requesting}>
        I&apos;m not on this list
      </Button>
    </div>
  );
}

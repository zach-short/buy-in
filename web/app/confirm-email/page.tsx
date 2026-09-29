'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useConfirmationWatch } from '@/hooks/use-confirmation-watch';
import { useResendConfirmation, type ResendState } from '@/hooks/use-resend-confirmation';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { ALL_WEBMAIL, webmailFor, type Webmail } from '@/lib/webmail';

function resendLabel({ status, cooldown }: ResendState): string {
  if (status === 'sending') return 'Sending…';
  return cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email';
}

function ResendButton({ resend }: { resend: ResendState }) {
  const { status, cooldown } = resend;
  return (
    <div className='space-y-2'>
      <Button
        type='button'
        variant='outline'
        onClick={resend.resend}
        disabled={cooldown > 0 || status === 'sending'}
        className='w-full h-11 tracking-widest uppercase text-xs'
      >
        {resendLabel(resend)}
      </Button>
      {status === 'sent' && <p className='text-xs text-muted-foreground tracking-wide text-center'>Sent again.</p>}
      {typeof status === 'object' && <p className='text-xs text-destructive tracking-wide text-center'>{status.error}</p>}
    </div>
  );
}

function OpenMailLink({ mail, label }: { mail: Webmail; label: string }) {
  return (
    <Button asChild variant='outline' className='w-full h-11 tracking-widest uppercase text-xs'>
      <a href={mail.url} target='_blank' rel='noopener noreferrer'>
        {label}
      </a>
    </Button>
  );
}

function OpenMail({ email }: { email: string }) {
  const known = webmailFor(email);
  if (known) return <OpenMailLink mail={known} label={`Open ${known.name}`} />;
  return (
    <div className='space-y-2'>
      <p className='text-xs text-muted-foreground tracking-wide text-center'>Open your inbox</p>
      {ALL_WEBMAIL.map((mail) => (
        <OpenMailLink key={mail.name} mail={mail} label={mail.name} />
      ))}
    </div>
  );
}

// useSearchParams() forces this subtree to opt out of static prerendering; Next.js
// requires a Suspense boundary around it (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).
export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmail />
    </Suspense>
  );
}

function ConfirmEmail() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email')?.trim() ?? '';
  const next = safeRedirectPath(searchParams.get('next'), '/');
  useConfirmationWatch(next);
  const resend = useResendConfirmation(email, next);

  return (
    <main className='min-h-dvh flex flex-col items-center justify-center px-6 py-12'>
      <div className='w-full max-w-xs space-y-8'>
        <div className='text-center space-y-1'>
          <h1 className='text-2xl font-semibold tracking-widest uppercase text-primary'>Buy-In</h1>
          <p className='text-xs text-muted-foreground tracking-widest uppercase'>Check your email</p>
        </div>

        <div className='space-y-2 text-center'>
          <p className='text-sm break-words'>
            {email ? `We sent a link to ${email}.` : 'We sent you a link.'} Open it to finish creating your account.
          </p>
          <p role='status' className='text-xs text-muted-foreground tracking-wide'>
            Waiting for you to confirm…
          </p>
        </div>

        {email && <OpenMail email={email} />}

        {email && <ResendButton resend={resend} />}

        <p className='text-center text-xs text-muted-foreground tracking-wide'>
          Wrong address?{' '}
          <Link href='/login' className='text-primary underline-offset-4 hover:underline'>
            Start over
          </Link>
        </p>
      </div>
    </main>
  );
}

import Link from 'next/link';

import { ContactLink, LegalPage, LegalSection } from '@/components/legal/legal-page';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description: 'The terms for using Buy-In.',
});

export default function TermsPage() {
  return (
    <LegalPage title='Terms of Service' updated='September 29, 2026'>
      <p>By using Buy-In (buy-in.win) you agree to these terms. If you do not agree, please do not use it.</p>

      <LegalSection title='What Buy-In is'>
        <p>
          Buy-In is a record-keeping tool. Hosts use it to run private home games: buy-ins, cash-outs,
          drinks and who owes whom. Players can also keep a private log of their own results from poker,
          casino games and sports bets. It does not hold, move or process money, and it does not take bets,
          set or quote odds, or connect to any sportsbook or casino: every payment and every bet happens
          outside Buy-In, for example in Venmo.
        </p>
      </LegalSection>

      <LegalSection title='Your responsibilities'>
        <ul className='list-disc space-y-2 pl-5'>
          <li>You are responsible for making sure your games and bets follow the laws where you play.</li>
          <li>Check the numbers before anyone pays. Balances are only as accurate as what was entered.</li>
          <li>Only add other people’s details with their permission, and keep your account secure.</li>
          <li>Do not misuse the service, try to break it, or access data that is not yours.</li>
        </ul>
      </LegalSection>

      <LegalSection title='Your data'>
        <p>
          What you enter stays yours. How we handle it is in the{' '}
          <Link href='/privacy' className='text-primary underline-offset-4 hover:underline'>Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title='No warranty'>
        <p>
          Buy-In is provided as is, without warranties of any kind. We are not liable for disputes between
          players, payments made or missed, or losses arising from use of the app, to the fullest extent the
          law allows.
        </p>
      </LegalSection>

      <LegalSection title='Changes and ending'>
        <p>
          We may update these terms or the service. If the terms change, the date at the top changes with
          them. You can stop using Buy-In at any time and ask for your account to be deleted.
        </p>
      </LegalSection>

      <LegalSection title='Contact'>
        <p>Questions go to <ContactLink />.</p>
      </LegalSection>
    </LegalPage>
  );
}

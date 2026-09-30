import { ContactLink, LegalPage, LegalSection } from '@/components/legal/legal-page';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description: 'What Buy-In collects, why, and how to have it deleted.',
});

export default function PrivacyPage() {
  return (
    <LegalPage title='Privacy Policy' updated='September 29, 2026'>
      <p>
        Buy-In (buy-in.win) helps hosts run home poker nights (the table, the drink tab, settling up and
        scheduling) and lets players keep a private record of their own results. This page explains what
        we collect, why, and what you can do about it.
      </p>

      <LegalSection title='What we collect'>
        <ul className='list-disc space-y-2 pl-5'>
          <li>
            <strong className='text-foreground'>Account details.</strong> Your email address. If you sign in
            with Google, we receive your email and basic profile (name and picture) from Google. We never see
            your Google password.
          </li>
          <li>
            <strong className='text-foreground'>What you enter.</strong> Your display name and Venmo handle,
            and the records of your games: buy-ins, cash-outs, drinks, payments, RSVPs and schedules.
          </li>
          <li>
            <strong className='text-foreground'>Players a host adds.</strong> Hosts can add players who have
            no account, with a name and optionally a phone number or Venmo handle. Hosts should only add
            details the player is happy to share.
          </li>
          <li>
            <strong className='text-foreground'>Results you log.</strong> Poker sessions, casino games and
            sports bets you record for yourself: the amounts in and out, the date, the place and any notes.
            This is a record of your gambling results, so treat your account as private.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title='How we use it'>
        <p>
          Only to run the app: signing you in, showing your tables and balances, working out who owes whom,
          and filling in Venmo requests. We do not sell your data, show ads, or use third-party analytics or
          tracking.
        </p>
      </LegalSection>

      <LegalSection title='Who can see it'>
        <p>
          The host and members of a bar can see that bar’s games and balances. Anyone holding a receipt,
          invite or RSVP link can see what that link shows, so share those links only with the people they
          are for. Results you log for yourself are visible only to you: not your host, not your tables, and
          not anyone holding a link.
        </p>
      </LegalSection>

      <LegalSection title='Where it lives'>
        <p>
          Data is stored with Supabase (database and sign-in) and the app is hosted on Vercel. Both process
          it on our behalf. Payments happen in Venmo, never in Buy-In: we never see or store card or bank
          details.
        </p>
      </LegalSection>

      <LegalSection title='Deleting your data'>
        <p>
          Email <ContactLink /> from the address on your account and we will delete your account and the
          data tied to it. Records a host keeps for a game you played in may stay in that host’s history
          without your account attached.
        </p>
      </LegalSection>

      <LegalSection title='Changes and contact'>
        <p>
          If this policy changes, the date at the top changes with it. Questions go to <ContactLink />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

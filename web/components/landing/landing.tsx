'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { BarChart3, CalendarDays, Smartphone, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LiveTableDemo } from './live-table-demo';
import { MenuDemo } from './menu-demo';
import { ReceiptDemo } from './receipt-demo';
import { Reveal } from './reveal';
import { SettleDemo } from './settle-demo';
import { SpotlightCard } from './spotlight-card';

const STEPS = [
  { n: 'I', title: 'Open the table', body: 'Start a session and add who’s playing. Your players don’t need an account.' },
  { n: 'II', title: 'Play and pour', body: 'Buy-ins, rebuys and every drink land on each player’s tab as they happen.' },
  { n: 'III', title: 'Settle up', body: 'Enter the cash-outs. Buy-In works out what each player owes and hands the payment to Venmo.' },
] as const;

const EXTRAS = [
  { icon: CalendarDays, title: 'Schedule and RSVP', body: 'Pick a date, send an RSVP link, and see who’s coming before you set up the chairs.' },
  { icon: Users, title: 'Players', body: 'Every regular in one list, with their history across nights.' },
  { icon: BarChart3, title: 'Stats', body: 'Revenue, cost and profit for the bar, and results for the table, night by night.' },
  { icon: Smartphone, title: 'On your home screen', body: 'Runs in the browser. Add it to your home screen and it opens like an app.' },
] as const;

function Backdrop() {
  return (
    <div aria-hidden className='pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background'>
      <div className='landing-glow landing-glow-a' />
      <div className='landing-glow landing-glow-b' />
      <div className='landing-grain' />
    </div>
  );
}

function Nav() {
  return (
    <header className='mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6'>
      <span className='font-display text-sm font-semibold tracking-widest uppercase text-primary'>Buy-In</span>
      <nav className='flex items-center gap-6'>
        <Link href='/login' className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'>
          Log in
        </Link>
        <Button asChild size='sm' className='text-xs tracking-widest uppercase'>
          <Link href='/signup'>Get started</Link>
        </Button>
      </nav>
    </header>
  );
}

function Actions() {
  return (
    <div className='flex flex-wrap items-center gap-3'>
      <Button asChild size='lg' className='h-12 px-7 text-xs tracking-widest uppercase landing-cta'>
        <Link href='/signup'>Get started</Link>
      </Button>
      <Button asChild size='lg' variant='outline' className='h-12 px-7 text-xs tracking-widest uppercase'>
        <Link href='/login'>Log in</Link>
      </Button>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className='text-[11px] font-semibold tracking-[0.2em] uppercase text-primary'>{children}</p>;
}

function Hero() {
  return (
    <section className='mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pt-12 pb-24 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-32'>
      <Reveal className='space-y-7'>
        <Eyebrow>For home games</Eyebrow>
        <h1 className='text-4xl leading-[1.1] sm:text-5xl lg:text-6xl'>
          <span className='landing-shimmer'>The bar and the bank for your poker night.</span>
        </h1>
        <p className='max-w-[46ch] text-base leading-relaxed text-muted-foreground sm:text-lg'>
          Track buy-ins, pour from a real menu, and settle up with one tap per player when the game breaks.
        </p>
        <Actions />
        <p className='max-w-[52ch] text-xs leading-relaxed text-muted-foreground'>
          Buy-In never holds the money. Payments go straight between you and your players, through Venmo.
        </p>
      </Reveal>
      <Reveal delay={150} className='min-w-0'>
        <LiveTableDemo />
      </Reveal>
    </section>
  );
}

function Steps() {
  return (
    <section className='mx-auto w-full max-w-6xl px-6 pb-28'>
      <Reveal className='mb-10 space-y-3'>
        <Eyebrow>How a night runs</Eyebrow>
        <h2 className='text-2xl sm:text-3xl'>Three steps, start to settle.</h2>
      </Reveal>
      <ol className='grid gap-4 md:grid-cols-3'>
        {STEPS.map((step, i) => (
          <li key={step.n}>
            <Reveal delay={i * 120} className='h-full'>
              <SpotlightCard className='h-full p-6'>
                <p className='font-display text-3xl text-primary/80'>{step.n}</p>
                <h3 className='mt-5 text-base'>{step.title}</h3>
                <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>{step.body}</p>
              </SpotlightCard>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Feature({
  eyebrow,
  title,
  body,
  cue,
  flip,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cue: string;
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <section className='mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2 md:gap-16 md:py-28'>
      <Reveal className={cn('space-y-5', flip && 'md:order-2')}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className='text-3xl leading-tight sm:text-4xl'>{title}</h2>
        <p className='max-w-[48ch] text-base leading-relaxed text-muted-foreground'>{body}</p>
      </Reveal>
      <Reveal delay={120}>
        {children}
        <p className='mt-4 text-center text-xs italic text-muted-foreground'>{cue}</p>
      </Reveal>
    </section>
  );
}

function Extras() {
  return (
    <section className='mx-auto w-full max-w-6xl px-6 py-20 md:py-28'>
      <Reveal className='mb-10 space-y-3'>
        <Eyebrow>Also on the table</Eyebrow>
        <h2 className='text-2xl sm:text-3xl'>Everything else a host keeps track of.</h2>
      </Reveal>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {EXTRAS.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} delay={i * 90} className='h-full'>
            <SpotlightCard className='h-full p-6'>
              <span className='flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary'>
                <Icon size={18} />
              </span>
              <h3 className='mt-5 text-sm'>{title}</h3>
              <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>{body}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className='mx-auto w-full max-w-6xl px-6 py-24 md:py-32'>
      <Reveal>
        <SpotlightCard className='relative overflow-hidden px-6 py-16 text-center sm:px-12'>
          <div aria-hidden className='landing-halo landing-halo-center' />
          <h2 className='relative text-3xl sm:text-5xl'>
            <span className='landing-shimmer'>Open your bar.</span>
          </h2>
          <p className='relative mx-auto mt-4 max-w-[44ch] text-base text-muted-foreground'>
            Name your bar, add your Venmo handle, and start your first session.
          </p>
          <div className='relative mt-8 flex justify-center'>
            <Actions />
          </div>
        </SpotlightCard>
      </Reveal>
    </section>
  );
}

export function Landing() {
  return (
    <div className='relative min-h-dvh overflow-x-clip'>
      <Backdrop />
      {/* Scrolls with the page rather than sitting in the fixed backdrop, so it stays behind the hero. */}
      <div aria-hidden className='landing-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[56rem]' />
      <Nav />
      <main>
        <Hero />
        <Steps />
        <Feature
          eyebrow='The bar'
          title='A menu that matches the shelf.'
          body='Build drinks from what’s in your inventory. When a bottle runs out, every drink that needs it drops off the menu your guests see. Each order records its cost beside its price, so the night ends with revenue, cost and profit.'
          cue='Tap a bottle to run it dry.'
        >
          <MenuDemo />
        </Feature>
        <Feature
          flip
          eyebrow='Settle up'
          title='One tap per player.'
          body='Cash-outs go in, balances come out. Each payment opens Venmo with the amount and the note already filled in. The money moves between you and your players, never through Buy-In.'
          cue='Tap each player to mark them paid.'
        >
          <SettleDemo />
        </Feature>
        <Feature
          eyebrow='Receipts'
          title='Everyone gets their own tab.'
          body='Send each player a link to an itemized receipt: every buy-in, every drink, the cash-out and what’s left to pay. They can open it without an account, and claim one later to keep their history.'
          cue='Maya’s receipt, from the night above.'
        >
          <ReceiptDemo />
        </Feature>
        <Extras />
        <Closing />
      </main>
      <footer className='mx-auto flex w-full max-w-6xl items-center justify-between border-t border-border px-6 py-8 text-xs text-muted-foreground'>
        <span className='font-display tracking-widest uppercase text-primary'>Buy-In</span>
        <span>Home bar management for poker nights</span>
      </footer>
    </div>
  );
}

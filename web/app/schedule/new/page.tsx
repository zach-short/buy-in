'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { HeaderAction, PageHeader, PageMain } from '@/components/shared/layout/page';
import { useScheduleGame, type ScheduleGameForm } from '@/hooks/use-schedule-game';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LABEL = 'text-xs tracking-widest uppercase text-muted-foreground mb-2 block';

export default function ScheduleGamePage() {
  const router = useRouter();
  const form = useScheduleGame();

  return (
    <PageMain>
      <PageHeader title='Schedule Game' actions=<HeaderAction onClick={() => router.back()}>Back</HeaderAction> />

      {form.inviteUrl ? <InviteReady name={form.name.trim()} url={form.inviteUrl} /> : <ScheduleForm form={form} />}
    </PageMain>
  );
}

function ScheduleForm({ form }: { form: ScheduleGameForm }) {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.canSubmit) return;
    try {
      await form.submit();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <div>
        <label htmlFor='game-name' className={LABEL}>Name</label>
        <Input
          id='game-name'
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          disabled={form.scheduled}
          className='h-11'
          placeholder='Friday night game'
        />
      </div>

      <div>
        <label htmlFor='game-date' className={LABEL}>When</label>
        <div className='flex gap-2'>
          <Input
            id='game-date'
            type='date'
            min={form.today}
            value={form.date}
            onChange={(e) => form.setDate(e.target.value)}
            disabled={form.scheduled}
            className='h-11'
          />
          <Input
            aria-label='Time'
            type='time'
            value={form.time}
            onChange={(e) => form.setTime(e.target.value)}
            disabled={form.scheduled}
            className='h-11 w-32 shrink-0'
          />
        </div>
        <p className='text-xs text-muted-foreground mt-1'>When the night arrives, start it from Schedule</p>
      </div>

      <Button type='submit' size='lg' className='w-full h-12 text-xs tracking-widest uppercase mt-2' disabled={!form.canSubmit}>
        {form.submitting ? 'Scheduling…' : form.scheduled ? 'Retry Invite Link' : 'Schedule & Get Invite Link'}
      </Button>
    </form>
  );
}

function InviteReady({ name, url }: { name: string; url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <p className={LABEL}>{name} — invite link</p>
        <p className='border border-border rounded-md px-4 py-3 text-sm break-all select-all'>{url}</p>
        <p className='text-xs text-muted-foreground mt-1'>Send it to the group — guests RSVP through it before the night</p>
      </div>

      <Button size='lg' className='w-full h-12 text-xs tracking-widest uppercase' onClick={copy}>
        Copy Link
      </Button>
      <Button asChild size='lg' variant='outline' className='w-full h-12 text-xs tracking-widest uppercase'>
        <Link href='/schedule'>Done</Link>
      </Button>
    </div>
  );
}

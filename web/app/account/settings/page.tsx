'use client';

import { useRouter } from 'next/navigation';

import { DefaultBuyInSetting } from '@/components/shared/default-buy-in-setting';
import { VenmoNoteSetting } from '@/components/shared/venmo-note-setting';

export default function SettingsPage() {
  const router = useRouter();

  return (
    <main className='min-h-screen px-6 py-10 max-w-3xl mx-auto'>
      <div className='flex items-center justify-between mb-10'>
        <h1 className='text-base font-semibold tracking-widest uppercase text-primary'>Settings</h1>
        <button
          onClick={() => router.back()}
          className='text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
        >
          Back
        </button>
      </div>

      <VenmoNoteSetting />
      <DefaultBuyInSetting />
    </main>
  );
}

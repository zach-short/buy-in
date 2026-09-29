'use client';

import Link from 'next/link';

import { BackAction } from '@/components/shared/layout/back-action';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { DefaultBuyInSetting } from '@/components/shared/default-buy-in-setting';
import { DeleteAccountSetting } from '@/components/shared/delete-account-setting';
import { HostFeaturesSetting } from '@/components/shared/host-features-setting';
import { PaymentHandlesSetting } from '@/components/shared/payment-handles-setting';
import { VenmoNoteSetting } from '@/components/shared/venmo-note-setting';

export default function SettingsPage() {
  return (
    <PageMain>
      <PageHeader title='Settings' actions={<BackAction fallback='/account' />} />

      <PaymentHandlesSetting />
      <VenmoNoteSetting />
      <DefaultBuyInSetting />
      <HostFeaturesSetting />
      <Link
        href='/account/settings/whats-new'
        className='flex items-center justify-between border border-border rounded-md p-4 mb-6 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors'
      >
        What&apos;s new
        <span className='text-primary'>›</span>
      </Link>
      <DeleteAccountSetting />
    </PageMain>
  );
}

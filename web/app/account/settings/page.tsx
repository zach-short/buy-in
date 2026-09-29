'use client';

import { BackAction } from '@/components/shared/layout/back-action';
import { PageHeader, PageMain } from '@/components/shared/layout/page';
import { DefaultBuyInSetting } from '@/components/shared/default-buy-in-setting';
import { DeleteAccountSetting } from '@/components/shared/delete-account-setting';
import { PaymentHandlesSetting } from '@/components/shared/payment-handles-setting';
import { VenmoNoteSetting } from '@/components/shared/venmo-note-setting';

export default function SettingsPage() {
  return (
    <PageMain>
      <PageHeader title='Settings' actions={<BackAction fallback='/account' />} />

      <PaymentHandlesSetting />
      <VenmoNoteSetting />
      <DefaultBuyInSetting />
      <DeleteAccountSetting />
    </PageMain>
  );
}

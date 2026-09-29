'use client';

import { useRouter } from 'next/navigation';

import { HeaderAction, PageHeader, PageMain } from '@/components/shared/layout/page';
import { DefaultBuyInSetting } from '@/components/shared/default-buy-in-setting';
import { DeleteAccountSetting } from '@/components/shared/delete-account-setting';
import { PaymentHandlesSetting } from '@/components/shared/payment-handles-setting';
import { VenmoNoteSetting } from '@/components/shared/venmo-note-setting';

export default function SettingsPage() {
  const router = useRouter();

  return (
    <PageMain>
      <PageHeader title='Settings' actions={<HeaderAction onClick={() => router.back()}>Back</HeaderAction>} />

      <PaymentHandlesSetting />
      <VenmoNoteSetting />
      <DefaultBuyInSetting />
      <DeleteAccountSetting />
    </PageMain>
  );
}

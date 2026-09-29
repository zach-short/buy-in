'use client';

import { DrinksQuestion } from '@/components/host-setup/drinks-question';
import { SetupChecklist } from '@/components/host-setup/setup-checklist';
import { useSetupGuide } from '@/hooks/use-setup-guide';

// Home's first-run guide for a new host (host-setup PLAN phase 3). Renders nothing for a bar
// that has dismissed it, which 0020 backfilled for every bar that existed before it.
export function SetupGuide() {
  const { showQuestion, items, answerDrinks, dismiss } = useSetupGuide();
  return (
    <>
      {showQuestion && <DrinksQuestion onAnswer={answerDrinks} />}
      {items && <SetupChecklist items={items} onDismiss={dismiss} />}
    </>
  );
}

import { toast } from 'sonner';

import type { ShareResult } from '@/lib/share';

// One wording for both invite buttons. A dismissed share sheet is the host's answer, so it
// gets no toast; a completed share needs none either — the sheet already confirmed it.
export function announceShare(result: ShareResult): void {
  if (result === 'copied') toast.success('Invite copied — paste it into the group chat');
  if (result === 'failed') toast.error('Could not copy the invite — select the link and copy it');
}

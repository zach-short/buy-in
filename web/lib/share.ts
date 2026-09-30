// Share/copy helpers. Callers own the toast: 'failed' means neither path worked; 'cancelled' means
// the user dismissed the share sheet, so callers should stay silent.

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function copyText(text: string): Promise<'copied' | 'failed'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    // clipboard is undefined on insecure origins and rejects when the tab isn't focused
    return 'failed';
  }
}

export async function shareOrCopy(url: string): Promise<ShareResult> {
  return shareDataOrCopy({ url }, url);
}

async function shareDataOrCopy(data: ShareData, fallback: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      // a dismissed sheet is the user's answer, so no copy fallback and no error
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  return copyText(fallback);
}

// A shared link goes out bare — no text or title for the share target to prepend (owner's call,
// 2026-09-29, and it holds for every link, the payment reminder and the table invite included;
// the invite's card names the table through its page metadata, not through message text).

// `sms:<num>?&body=` is the form both iOS and Android parse: iOS wants `&` (or `;`) before
// `body` and Android wants `?`, and `?&` satisfies both. The old `sms:<num>&body=` dropped the
// body on Android. The number is stripped to digits and a leading `+`.
export function smsHref(phone: string | null, body: string): string {
  const number = phone ? phone.replace(/[^\d+]/g, '') : '';
  return `sms:${number}?&body=${encodeURIComponent(body)}`;
}

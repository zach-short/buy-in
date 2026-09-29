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

// A shared link goes out bare — no text or title for the share target to prepend (owner's call,
// 2026-09-29). `text` is only for a share that is a message rather than a link: the payment
// reminder, whose point is the amount owed.
export async function shareOrCopy(url: string, text?: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ url, text });
      return 'shared';
    } catch (e) {
      // a dismissed sheet is the user's answer, so no copy fallback and no error
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  return copyText(text ? `${text} ${url}` : url);
}

// `sms:<num>?&body=` is the form both iOS and Android parse: iOS wants `&` (or `;`) before
// `body` and Android wants `?`, and `?&` satisfies both. The old `sms:<num>&body=` dropped the
// body on Android. The number is stripped to digits and a leading `+`.
export function smsHref(phone: string | null, body: string): string {
  const number = phone ? phone.replace(/[^\d+]/g, '') : '';
  return `sms:${number}?&body=${encodeURIComponent(body)}`;
}

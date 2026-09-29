// Share/copy helpers. Callers own the toast: 'failed' means neither path worked; 'cancelled' means
// the user dismissed the share sheet, so callers should stay silent.

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

interface ShareInput {
  url: string;
  text?: string;
  title?: string;
}

export async function copyText(text: string): Promise<'copied' | 'failed'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    // clipboard is undefined on insecure origins and rejects when the tab isn't focused
    return 'failed';
  }
}

export async function shareOrCopy({ url, text, title }: ShareInput): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ url, text, title });
      return 'shared';
    } catch (e) {
      // a dismissed sheet is the user's answer, so no copy fallback and no error
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  // the copy carries the message too, or a pasted invite arrives as a bare link
  return copyText(text ? `${text} ${url}` : url);
}

// `sms:<num>?&body=` is the form both iOS and Android parse: iOS wants `&` (or `;`) before
// `body` and Android wants `?`, and `?&` satisfies both. The old `sms:<num>&body=` dropped the
// body on Android. The number is stripped to digits and a leading `+`.
export function smsHref(phone: string | null, body: string): string {
  const number = phone ? phone.replace(/[^\d+]/g, '') : '';
  return `sms:${number}?&body=${encodeURIComponent(body)}`;
}

// Per-browser, like the drinks answer: nothing server-side depends on it, and Account's "Host your
// own table" row stays for anyone who dismissed the card. Storage can throw (private windows,
// blocked site data), and then the card simply shows again.
const KEY = 'buy-in:host-prompt-dismissed';

export function readHostPromptDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function rememberHostPromptDismissed(): void {
  try {
    window.localStorage.setItem(KEY, new Date().toISOString());
  } catch {
    // The card comes back next visit; nothing is lost.
  }
}

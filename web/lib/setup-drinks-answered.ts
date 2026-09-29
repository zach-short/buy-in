// BD-12: the answer lives in serves_drinks; only "was it asked here" is per-browser. Storage can
// throw (private windows, blocked site data), and then the question simply shows again.
function answeredKey(barId: string): string {
  return `buy-in:setup-drinks-answered:${barId}`;
}

export function readDrinksAnswered(barId: string): boolean {
  try {
    return window.localStorage.getItem(answeredKey(barId)) !== null;
  } catch {
    return false;
  }
}

export function forgetDrinksAnswered(barId: string): void {
  try {
    window.localStorage.removeItem(answeredKey(barId));
  } catch {
    // Nothing stored, nothing to forget.
  }
}

export function rememberDrinksAnswered(barId: string): void {
  try {
    window.localStorage.setItem(answeredKey(barId), new Date().toISOString());
  } catch {
    // The answer is already saved on the bar; the question may ask once more.
  }
}

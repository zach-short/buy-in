/** US numbers: ten digits, no more. Owner's call 2026-09-29. */
export const PHONE_DIGITS = 10;

/**
 * The digits of whatever was typed or pasted, capped at ten. A pasted +1 or leading 1 in front
 * of a full number is dropped, so "+1 (555) 123-4567" reads as the number it is.
 */
export function phoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const national = digits.length > PHONE_DIGITS && digits.startsWith('1') ? digits.slice(1) : digits;
  return national.slice(0, PHONE_DIGITS);
}

/**
 * "(555) 123-4567", built up as the digits arrive: "(5", "(555", "(555) 1", … Feeding the
 * output back in gives the same output, so an input can format on every keystroke and a
 * backspace over a bracket or dash simply re-forms around the digits left.
 */
export function formatPhone(raw: string): string {
  const d = phoneDigits(raw);
  if (d.length === 0) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** A message for a number that cannot be whole, or null. Blank is fine: the field is optional. */
export function validatePhone(raw: string): string | null {
  const count = phoneDigits(raw).length;
  return count === 0 || count === PHONE_DIGITS ? null : 'Phone numbers are 10 digits';
}

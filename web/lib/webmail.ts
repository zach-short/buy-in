export type Webmail = { name: string; url: string };

const GMAIL: Webmail = { name: 'Gmail', url: 'https://mail.google.com' };
const OUTLOOK: Webmail = { name: 'Outlook', url: 'https://outlook.live.com/mail/' };
const YAHOO: Webmail = { name: 'Yahoo Mail', url: 'https://mail.yahoo.com' };
const ICLOUD: Webmail = { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' };
const PROTON: Webmail = { name: 'Proton Mail', url: 'https://mail.proton.me' };

export const ALL_WEBMAIL: readonly Webmail[] = [GMAIL, OUTLOOK, YAHOO, ICLOUD, PROTON];

const BY_DOMAIN: Record<string, Webmail> = {
  'gmail.com': GMAIL,
  'googlemail.com': GMAIL,
  'outlook.com': OUTLOOK,
  'hotmail.com': OUTLOOK,
  'live.com': OUTLOOK,
  'msn.com': OUTLOOK,
  'yahoo.com': YAHOO,
  'icloud.com': ICLOUD,
  'me.com': ICLOUD,
  'proton.me': PROTON,
  'protonmail.com': PROTON,
};

// Deliberately a fixed table, not an MX lookup: a custom or school domain (e.g. a Google
// Workspace address) returns null and the caller offers every provider instead of guessing.
export function webmailFor(email: string): Webmail | null {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  return domain ? (BY_DOMAIN[domain] ?? null) : null;
}

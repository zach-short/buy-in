export type PatchNoteKind = 'new' | 'fixed';

export type PatchNote = { kind: PatchNoteKind; text: string };

export type PatchRelease = { date: string; title: string; notes: PatchNote[] };

// Plain-language on purpose: what a player or host sees, never how it was built. Newest first.
// Add a release here when something users can notice ships.
export const PATCH_RELEASES: PatchRelease[] = [
  {
    date: 'Sep 29, 2026',
    title: 'Tighter money math and a smoother phone app',
    notes: [
      { kind: 'new', text: 'Settle up at the end of a night, with an undo if you tap the wrong thing.' },
      { kind: 'new', text: 'Players can report that they paid, and hosts can review the reports.' },
      { kind: 'new', text: 'Pour a drink anyway when stock says it is out, and archive or merge old nights.' },
      { kind: 'new', text: 'RSVPs now show details for each game night.' },
      { kind: 'new', text: 'Delete your account from Settings. It is blocked while you owe money or own a bar with history.' },
      { kind: 'new', text: 'Leave a table any time. You are warned first if you are owed money, and blocked if you owe.' },
      { kind: 'new', text: 'Migrated players can claim their old row from an invite link, with host approval.' },
      { kind: 'new', text: 'A new animated homepage for logged-out visitors shows a live table, menu, settle-up and receipt.' },
      { kind: 'fixed', text: 'Each night’s money is calculated and closed out correctly.' },
      { kind: 'fixed', text: 'The top of the screen no longer sits under the status bar in the installed app, and the bottom bar sits right above the home indicator.' },
      { kind: 'fixed', text: 'Every page without the bottom bar now has a back button that works in the installed app.' },
      { kind: 'fixed', text: 'Date and time fields look like the rest of the form fields on iPhone.' },
      { kind: 'fixed', text: 'Pages no longer scroll sideways on phones.' },
    ],
  },
  {
    date: 'Sep 28, 2026',
    title: 'Accounts, invites and game nights',
    notes: [
      { kind: 'new', text: 'Sign up as a host or a member. Invite links skip the role question.' },
      { kind: 'new', text: 'Sign in with Google.' },
      { kind: 'new', text: 'Schedule game nights and collect RSVPs.' },
      { kind: 'new', text: 'Set a default buy-in, and see each player’s performance history.' },
      { kind: 'new', text: 'Invite, RSVP, menu, tab and receipt links show a proper preview card when you share them.' },
      { kind: 'new', text: 'A new Account page with an install card, plus a bottom bar on phones and a top bar on the web.' },
      { kind: 'fixed', text: 'Invite and RSVP cards now name the table and the game night.' },
    ],
  },
  {
    date: 'Sep 16 – 27, 2026',
    title: 'Poker Bar becomes Buy-In',
    notes: [
      { kind: 'new', text: 'The app has a new name, Buy-In, and a new chip icon.' },
      { kind: 'new', text: 'Everything moved to a new, faster home. Your players, nights and balances came along.' },
      { kind: 'new', text: 'Sign-in was rebuilt on the new system.' },
      { kind: 'new', text: 'Menus are now per bar, and hosts can create share links for them.' },
      { kind: 'new', text: 'The Venmo note is editable.' },
      { kind: 'new', text: 'Receipts and other public pages open straight from their links.' },
      { kind: 'fixed', text: 'Money is now stored in whole cents, so totals never drift by a fraction.' },
    ],
  },
];

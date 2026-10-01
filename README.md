# Buy-In

Buy-In is a web app for running a home poker night. A host keeps the live table, the drink tab and the settle-up in one place, and each player can see what they owe and how they have done over time. The app records who owes whom. It does not hold, move or process money, so every payment happens outside it, for example in Venmo.

## What it does

A host creates a session, seats players, and records buy-ins, cash-outs and drink orders while the night runs. The live table updates through Supabase Realtime. When the night ends, the session summary gives each player a balance and a settle-up link that opens Venmo. Receipts are shared by link, and a player's portal page shows their full history without an account.

Around the session, a host manages a drink menu with recipes and prices, an inventory (spirits, mixers, syrups, garnishes and equipment) with reorder thresholds and cost per unit, and a schedule of upcoming games with RSVPs. Invites add people to the table as members. An invite is a link, a short code or both, and the host chooses how long it lasts.

Any account can open the Results page, which has three tabs: My poker, Everything and The bar. The bar tab appears only for hosts with stats turned on. Players can also log their own casino games and sports bets in a private log, and those entries show up on the Everything tab.

Sign-in is Google or email and password, and anyone can create an account at `/signup`. A new account then lands on `/welcome` to give a name and choose whether it hosts a table or only plays. A small set of pages works without a login: the homepage, sign-in and sign-up, the join and RSVP links, the public drink menu, receipts, the portal, and the terms and privacy pages. `web/proxy.ts` holds that list, and adding a path to it is a deliberate decision.

## Tech stack

- Web (`web/`): Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI, SWR, Recharts. It is a dark-theme PWA through `@ducanh2912/next-pwa`.
- Data and auth: Supabase Postgres with row-level security and Postgres functions, and Supabase Auth through `@supabase/ssr`. The browser and the server call Supabase directly. No separate API server exists.
- Shared code (`packages/core`, imported as `@pb/core`): platform-free logic (money in integer cents, balances, settle-up, Venmo links, invite codes), Zod schemas, and the generated database types. A future `native/` app could share it, but no `native/` app exists yet.
- Tooling: Bun workspaces (`web` and `packages/*`) and Vitest.

The earlier Go, Gin and MongoDB API is deleted, and `web/` does not depend on it. `scripts/import-mongo/` is the one-time script that moved its data into Supabase.

## Project layout

```
buy-in/
├── web/                     Next.js app
│   ├── app/                 routes (host pages, auth, and the token pages that need no login)
│   ├── components/          UI by feature; ui/ holds the Radix primitives
│   ├── hooks/, context/     React hooks and the SWR provider
│   ├── lib/                 env/ (env vars read once) and supabase/ (every data call)
│   ├── proxy.ts             login gate and session refresh (Next.js 16's name for middleware)
│   └── public/              static assets and the PWA manifest
├── packages/core/           @pb/core: src/ and tests/
├── supabase/                migrations/, templates/ (auth emails), config.toml (local stack)
├── scripts/                 buy-in (command menu), import-mongo/, delete-user.ts
└── docs/                    conventions, the working standard, and incomplete/ (one folder per effort)
```

Inside `web/lib/supabase/`, `client.ts`, `server.ts` and `middleware.ts` create the auth-aware clients, `queries.ts` holds the reads, `writes.ts` holds the RPC writes, `public.ts` holds the reads that use a link token instead of a login, and each feature has its own file beside them.

## Setup

You need Bun and a Supabase project. The Supabase CLI and a container runtime such as Docker are needed only for a local stack.

```bash
bun install
cp web/.env.example web/.env
bun run dev
```

Run `bun install` from the repo root, because the Bun workspaces cover `web/` and `packages/*`. Then fill in `web/.env`. Two values are required, and `web/lib/env/client.ts` throws at startup when either is missing:

```env
NEXT_PUBLIC_SUPABASE_URL=...              # the Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...  # its publishable key (public by design)
```

The example file also lists `NEXT_PUBLIC_VENMO_HANDLE`. No code reads it now, because Venmo handles are stored in the database. The dev server runs at http://localhost:3000.

The Supabase project needs three things before sign-in works:

1. Apply the files in `supabase/migrations/` in numeric order. They run from `0001` to `0032` at the time of writing, so read the directory for the current last number.
2. In Authentication, URL Configuration, allow `http://localhost:3000/auth/callback**` as a redirect URL, together with the production address when you deploy.
3. To offer Google sign-in, enable the Google provider. Email and password works without it. The project's Confirm email setting decides whether a new account signs in at once or waits for the email link, and the sign-up flow handles both.

For a local stack, run `supabase start` from the repo root. It reads `supabase/config.toml`, which puts the API on port 54321 and Postgres on port 54322. If a local database already exists, `supabase migration up --local` applies the migrations it lacks. Then point `web/.env` at `http://127.0.0.1:54321` with the publishable key that `supabase status` prints.

## Commands

```bash
bun run dev                            # next dev --turbopack
bun run build                          # next build --webpack
bun run test                           # vitest, from the repo root
cd web && bun run lint                 # eslint
cd web && npx tsc --noEmit             # typecheck web
cd packages/core && npx tsc --noEmit   # typecheck core
```

`bun run build` also writes the service worker files (`sw.js` and `workbox-*.js`) into `web/public/`. Git ignores them. The lint run exits 0 today, with warnings and no errors.

Run the tests with `bun run test` and not `bun test`. Bun's own runner ignores `vitest.config.mts`, which pins the time zone to America/New_York, so the date-format tests then depend on the machine. The tests live in `packages/core/tests/`, one file per module, and nothing in `web/` has a test yet. `scripts/buy-in` is a command menu that wraps the commands above, and its `gates` command runs build, typecheck, lint and test in sequence.

The repo has no CI workflow. A green build proves that the code compiles and does not prove that a screen works, so check a change in the browser.

## Deployment

The app deploys to Vercel, and its public address is buy-in.win. The repo has no `vercel.json`, no `.vercel` folder and no workflow, so the project settings live in the Vercel dashboard and cannot be read from a checkout. Set the two Supabase variables there. Vercel supplies `VERCEL_PROJECT_PRODUCTION_URL`, which `web/lib/env/site.ts` uses as the origin for link-preview images, and the app falls back to `http://localhost:3000` without it. Because the checkout cannot show whether a push to `main` triggers a deploy, treat a push as one.

Database changes ship separately from the web build. Apply a new migration to the Supabase project before you deploy code that needs it.

## Rules that hold across the code

- Money is integer cents everywhere. A float in a balance is a bug.
- `packages/core` imports nothing from `next` or `react-native` and never touches `window` or `document`.
- An applied migration is never edited. Add the next number instead.
- `packages/core/src/database.types.ts` is generated from the live schema with `supabase gen types typescript` and is never edited by hand.

## Where to read next

`HANDOFF.md` records what is true: the environment, the settled decisions and a numbered log of the work. `PASSOFF.md` lists what is next. `CLAUDE.md` holds the rules for agent sessions, `docs/AGENT-PRACTICES.md` is the working standard, and `docs/conventions-typescript.md` is the code standard. These five files are excluded from git through `.git/info/exclude`, so they exist in the owner's checkout and not in a fresh clone.

The tracked design documents are in `docs/incomplete/`, one folder per effort: `supabase-migration`, `member-home`, `logged-sessions`, `log-events`, `invite-codes` and `game-stakes`. `docs/migration-plan.md` is the original migration plan and is superseded by `docs/incomplete/supabase-migration/DESIGN.md`.

## License

MIT

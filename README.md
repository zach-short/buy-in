# Buy-In

A full-stack bar management app for poker nights. Track players, poker sessions, drink orders, inventory, and costs — all in one place.

## Features

- **Sessions** — Create and manage poker sessions, assign players, track status (active/closed)
- **Players** — Maintain a roster of players across sessions
- **Drink Menu** — Define drink recipes with ingredients, pricing, and cost estimates
- **Orders** — Log drink orders per player per session
- **Inventory** — Track bar stock (spirits, mixers, garnishes, syrups, equipment) with reorder thresholds and cost-per-unit
- **Auth** — Supabase Auth, email and password only (`web/lib/supabase/`, `web/proxy.ts`); no
  social/OAuth provider, by decision (`docs/incomplete/supabase-migration/DESIGN.md` `D5`)

## Tech Stack

- **Web** (`web/`) — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI,
  Supabase Auth via `@supabase/ssr` (email and password only), talking directly to Postgres via
  Supabase RLS and Postgres functions (`web/lib/supabase/**`)
- **Shared** (`packages/core`, `@pb/core`) — platform-free logic and Zod schemas, meant to be
  shared with a future `native/` app.
- The legacy Go/Gin/MongoDB API (`backend/`) is deleted (`docs/incomplete/supabase-migration/PLAN.md`
  phase 10); `web/` has no dependency on it.

## Project Structure

See `HANDOFF.md` for what is actually built and verified.

```
buy-in/
├── web/                      # Next.js application (App Router) — talks to Supabase directly
│   ├── app/                  # drinks, inventory, menu, players, session(s), stats,
│   │                         #   (protected)/dashboard, login,
│   │                         #   player-receipt, portal, receipt
│   ├── components/           # shared/ (navbar, buttons), ui/ (Radix primitives)
│   ├── lib/                  # supabase/ (browser, server, proxy clients, queries, writes),
│   │                         #   env/, utils.ts
│   ├── hooks/, context/      # React hooks and contexts
│   └── public/               # static assets + generated PWA workers (sw.js, workbox-*.js)
│
├── packages/core/            # @pb/core — platform-free shared logic and Zod schemas
│
└── supabase/
    ├── migrations/                # numbered, applied SQL — 0001-0003 as of 2026-09-27
    └── functions/                 # empty
```

## Setup

Bun-workspace monorepo (`web/`, `packages/core`) on Supabase Postgres — see `HANDOFF.md` for
what actually works. Every data read and write goes directly to Supabase (RLS + Postgres
functions); sign-in goes through Supabase Auth.

### Prerequisites

- Bun — the workspace package manager for `web` and `packages/*`
- A Supabase project — for sign-in (Supabase Auth) and data; its URL and keys go in `web/.env`

### Web (`web/`)

```bash
bun install                    # from the repo root — bun workspaces cover web/ and packages/*
cp web/.env.example web/.env   # then fill in real values, not the placeholders
bun run dev
```

Runs at http://localhost:3000. `web/.env` needs:
```env
NEXT_PUBLIC_SUPABASE_URL=...                # the Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...    # its publishable key (public by design)
NEXT_PUBLIC_VENMO_HANDLE=@...               # settle-up deep-link recipient
```

Sign-in is Supabase Auth, email and password only; there is no OAuth setup step because no
OAuth provider is offered (`D5`). There is no sign-up screen — a host's user is created in the
Supabase dashboard (Authentication → Users → Add user, with the email auto-confirmed).

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import in Vercel, set env vars, deploy

## License

MIT

# Buy-In

A full-stack bar management app for poker nights. Track players, poker sessions, drink orders, inventory, and costs — all in one place.

## Features

- **Sessions** — Create and manage poker sessions, assign players, track status (active/closed)
- **Players** — Maintain a roster of players across sessions
- **Drink Menu** — Define drink recipes with ingredients, pricing, and cost estimates
- **Orders** — Log drink orders per player per session
- **Inventory** — Track bar stock (spirits, mixers, garnishes, syrups, equipment) with reorder thresholds and cost-per-unit
- **Auth** — Credentials-only sign-in via NextAuth.js (`web/lib/auth.ts`); no social/OAuth
  provider is registered today

## Tech Stack

- **Web** (`web/`) — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI,
  NextAuth v5 (credentials provider only)
- **Backend** (`backend/`, legacy) — Go (Gin), JWT authentication, MongoDB. Planned for
  deletion, not yet removed — see `docs/migration-plan.md`.
- **Shared** (`packages/core`, `@pb/core`) — platform-free logic and Zod schemas, meant to be
  shared with a future `native/` app. Currently `export {}`: an empty shell, imported by
  nothing yet.
- **Migration target — planned, not built** (`docs/migration-plan.md`) — direct-to-Supabase
  Postgres with RLS and Postgres functions, replacing `backend/` and its MongoDB store.
  `supabase/migrations/0001_init.sql` exists but has never been applied to any project.

## Project Structure

**Mid-migration**: this is the tree as it exists today, not the target architecture. See
`docs/migration-plan.md` for the plan and `HANDOFF.md` for what is actually built and verified.

```
buy-in/
├── web/                      # Next.js application (App Router) — talks to backend/ today
│   ├── app/                  # drinks, inventory, menu, players, session(s), stats,
│   │                         #   (protected)/dashboard, login, api/auth,
│   │                         #   player-receipt, portal, receipt
│   ├── components/           # auth/, shared/ (navbar, buttons), ui/ (Radix primitives)
│   ├── lib/                  # NextAuth config, API clients (api.ts, bar-api.ts), utils.ts
│   ├── models/, types/       # TypeScript types local to web
│   ├── hooks/, context/      # React hooks and contexts
│   └── public/               # static assets + generated PWA workers (sw.js, workbox-*.js)
│
├── packages/core/            # @pb/core — platform-free shared logic and Zod schemas.
│                             #   An empty shell today; nothing imports it yet.
│
├── backend/                  # legacy Go/Gin/MongoDB API — planned for deletion, still builds
│   ├── handlers/             # auth, drinks, inventory, orders, players, sessions, portal
│   ├── middleware/           # JWT auth middleware
│   ├── models/               # data models
│   ├── routes/               # route definitions
│   ├── config/                # DB connection
│   ├── seed/                  # seed data
│   └── utils/                 # JWT utilities
│
└── supabase/
    ├── migrations/0001_init.sql   # the Postgres schema the migration targets — planned,
    │                              #   never applied to any project
    └── functions/                 # empty
```

## Setup

**The repo is mid-migration**, from a `frontend/` + Go/MongoDB app to this Bun-workspace
monorepo (`web/`, `packages/core`) on Supabase Postgres — see `docs/migration-plan.md` for the
plan and `HANDOFF.md` for what actually works today. Right now `web/` still talks to the Go API
in `backend/` over `NEXT_PUBLIC_API_URL`; nothing is wired to Supabase yet.

### Prerequisites

- Bun — the workspace package manager for `web` and `packages/*`
- Go 1.24+ — for `backend/`, the current (legacy) API
- MongoDB (local or Atlas) — `backend/`'s current database
- A Supabase project — not needed yet; nothing in this repo is wired to Supabase today

### Web (`web/`)

```bash
bun install                    # from the repo root — bun workspaces cover web/ and packages/*
cp web/.env.example web/.env   # then fill in real values, not the placeholders
bun run dev
```

Runs at http://localhost:3000. `web/.env` needs:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080   # the backend/ API origin
AUTH_SECRET=...                             # NextAuth secret
NEXT_PUBLIC_VENMO_HANDLE=@...               # settle-up deep-link recipient
```

Auth is credentials-only (`web/lib/auth.ts`); there is no OAuth setup step because no OAuth
provider is registered.

### Backend (`backend/`, legacy — planned for deletion)

```bash
cd backend
go mod download
```

`backend/` ships no `.env.example` — create `backend/.env` directly with:
```env
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=buy-in
JWT_SECRET=your-secret-key-here-change-in-production
PORT=8080
GIN_MODE=debug
```

```bash
go run main.go
```

Backend runs at http://localhost:8080

## API Routes

### Auth (Public)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Email/password login |
| POST | `/auth/register` | Register new account |
| POST | `/auth/social` | Social login |
| POST | `/auth/check-email` | Check if email exists |

### Bar (Protected)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/sessions` | List / create sessions |
| GET/PUT/DELETE | `/sessions/:id` | Get / update / delete session |
| GET/POST | `/players` | List / create players |
| GET/PUT/DELETE | `/players/:id` | Get / update / delete player |
| GET/POST | `/drinks` | List / create drink recipes |
| GET/PUT/DELETE | `/drinks/:id` | Get / update / delete drink |
| GET/POST | `/inventory` | List / create inventory items |
| GET/PUT/DELETE | `/inventory/:id` | Get / update / delete item |
| GET/POST | `/orders` | List / create orders |
| GET | `/orders/session/:id` | Orders for a session |

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import in Vercel, set env vars, deploy

### Backend

Any Go-compatible host (Railway, Render, Fly.io, DigitalOcean). Set `GIN_MODE=release` and update CORS origins in `main.go`.

## License

MIT

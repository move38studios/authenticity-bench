# Authenticity Bench - Architecture

## Overview

A web application for running benchmarks across AI models. Built with Next.js 16, deployed on Vercel, with invite-only access controlled via email whitelist.

## Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Framework    | Next.js 16 (App Router, Turbopack)  |
| Language     | TypeScript                          |
| Database     | Neon Postgres (serverless)          |
| ORM          | Drizzle ORM                         |
| Auth         | Better Auth 1.5                     |
| Email        | Resend                              |
| UI           | shadcn/ui, Tailwind CSS v4          |
| Deployment   | Vercel                              |
| Package Mgr  | pnpm                                |

## Project Structure

```
authenticity-bench/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── auth/[...all]/route.ts   # Better Auth catch-all handler
│   │   └── admin/whitelist/route.ts # Whitelist CRUD API (admin-only)
│   ├── dashboard/
│   │   ├── layout.tsx               # Server-side session gate
│   │   ├── page.tsx                 # Main dashboard
│   │   └── admin/page.tsx           # Admin: whitelist manager
│   ├── sign-in/page.tsx             # OTP sign-in flow
│   ├── page.tsx                     # Landing page
│   ├── layout.tsx                   # Root layout (Geist fonts)
│   └── globals.css                  # Tailwind v4 + shadcn CSS vars
├── components/
│   ├── ui/                          # shadcn components (owned source)
│   ├── dashboard-nav.tsx            # Nav bar (admin link, sign out)
│   └── whitelist-manager.tsx        # Admin whitelist UI
├── lib/
│   ├── auth.ts                      # Better Auth server config
│   ├── auth-client.ts               # Better Auth React client
│   ├── utils.ts                     # cn() utility
│   ├── db/
│   │   ├── index.ts                 # Drizzle + Neon HTTP connection
│   │   └── schema.ts               # All table definitions
│   └── services/
│       ├── email.ts                 # Email abstraction (Resend prod, console dev)
│       └── whitelist.ts             # Email whitelist checker
├── scripts/
│   └── seed.ts                      # Seeds first admin email into whitelist
├── drizzle/                         # Generated SQL migrations
├── proxy.ts                         # Next.js 16 proxy (replaces middleware)
├── drizzle.config.ts                # Drizzle Kit config
└── components.json                  # shadcn/ui config
```

## Authentication

### Flow

1. User enters email on `/sign-in`
2. A `before` hook in Better Auth checks the `allowed_email` table
3. If not whitelisted, returns 403 — no OTP is sent
4. If whitelisted, a 6-digit OTP is sent via Resend (or logged to console in dev)
5. User enters OTP (auto-submits on 6th digit)
6. Better Auth creates user + session on first sign-in

### Plugins

- **admin** — adds `role`, `banned`, `banReason`, `banExpires` fields to user table. Admin users can manage other users via Better Auth's admin API.
- **emailOTP** — passwordless OTP sign-in. 6 digits, 5 min expiry.

### Route Protection

- `proxy.ts` checks for session cookie on `/dashboard/*` routes, redirects to `/sign-in` if absent (edge/CDN level)
- `app/dashboard/layout.tsx` validates the session server-side and redirects if invalid (SSR level)
- Admin pages additionally check `session.user.role === "admin"`

## Database

### Connection

Uses `@neondatabase/serverless` with the HTTP driver (`neon-http`) — stateless, ideal for serverless/edge. Schema is passed to the drizzle instance for relational queries.

### Tables

| Table            | Purpose                                      |
|------------------|----------------------------------------------|
| `user`           | Users with role, ban fields (Better Auth)     |
| `session`        | Active sessions, impersonation (Better Auth)  |
| `account`        | OAuth/credential accounts (Better Auth)       |
| `verification`   | OTP and email verification tokens             |
| `allowed_email`  | Email/domain whitelist (custom)               |

### Migration Workflow

```bash
pnpm db:generate   # Generate SQL from schema changes
pnpm db:migrate    # Apply migrations to Neon
pnpm db:push       # Push schema directly (dev shortcut)
pnpm db:studio     # Open Drizzle Studio GUI
```

Schema lives in `lib/db/schema.ts`. Drizzle Kit reads `.env.local` via dotenv (configured in `drizzle.config.ts`).

## Email Service

`lib/services/email.ts` wraps Resend behind a simple `sendEmail({ to, subject, html })` interface.

- **Development** (`NODE_ENV=development`): logs to console, no emails sent
- **Production**: sends via Resend using `FROM_EMAIL` env var

To swap providers, only this file needs to change.

## Whitelist System

Only whitelisted emails can sign in. The whitelist is stored in the `allowed_email` table with two match modes:

- **email**: exact match (e.g. `jane@company.com`)
- **domain**: all emails from a domain (e.g. `company.com` matches `anyone@company.com`)

### Admin Management

Admins manage the whitelist at `/dashboard/admin` via the API at `/api/admin/whitelist` (GET/POST/DELETE, all admin-gated).

### Bootstrapping

1. Set `SEED_ADMIN_EMAIL` in `.env.local`
2. Run `pnpm db:seed` to add the email to the whitelist
3. Sign in with that email
4. Promote to admin: `UPDATE "user" SET role='admin' WHERE email='...'` (via Drizzle Studio or Neon console)
5. From then on, manage the whitelist from the admin UI

## Environment Variables

| Variable             | Required | Description                        |
|----------------------|----------|------------------------------------|
| `DATABASE_URL`       | Yes      | Neon Postgres connection string    |
| `BETTER_AUTH_SECRET` | Yes      | Auth secret (min 32 chars)         |
| `BETTER_AUTH_URL`    | Yes      | App base URL                       |
| `RESEND_API_KEY`     | Yes      | Resend API key                     |
| `FROM_EMAIL`         | Yes      | Verified sender email for Resend   |
| `SEED_ADMIN_EMAIL`   | No       | First admin email (for seeding)    |
| `NEXT_PUBLIC_APP_URL`| Yes      | Public app URL (client-side)       |

## Adding shadcn Components

```bash
pnpm dlx shadcn@latest add [component-name]
```

Components are installed as owned source code in `components/ui/`. The theme uses oklch colors with a clean, light academic feel (no dark mode).

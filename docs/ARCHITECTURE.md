# Authenticity Bench - Architecture

## Overview

A web application for running benchmarks across AI models to measure authenticity — honest, self-consistent behavior across different values systems, cognitive approaches, and situational pressures. Built with Next.js 16, deployed on Vercel, with invite-only access controlled via email whitelist.

## Stack

| Layer            | Technology                          |
|------------------|-------------------------------------|
| Framework        | Next.js 16 (App Router, Turbopack)  |
| Language         | TypeScript                          |
| Database         | Neon Postgres (serverless)          |
| ORM              | Drizzle ORM                         |
| Auth             | Better Auth 1.5                     |
| Email            | Resend                              |
| UI               | shadcn/ui, Tailwind CSS v4          |
| AI SDK           | Vercel AI SDK                       |
| Background Jobs  | Vercel/Cloudflare durable workflows |
| Code Execution   | E2B or Cloudflare Containers        |
| Deployment       | Vercel                              |
| Package Mgr      | pnpm                                |

## Project Structure

```
authenticity-bench/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/route.ts        # Better Auth catch-all
│   │   ├── admin/whitelist/route.ts      # Whitelist CRUD (admin-only)
│   │   ├── models/route.ts              # Model config CRUD
│   │   ├── dilemmas/route.ts            # Dilemma CRUD
│   │   ├── values/route.ts             # Values system CRUD
│   │   ├── techniques/route.ts          # Mental technique CRUD
│   │   ├── modifiers/route.ts           # Modifier CRUD
│   │   ├── experiments/
│   │   │   ├── route.ts                 # Experiment CRUD
│   │   │   ├── [id]/run/route.ts        # Trigger experiment execution
│   │   │   ├── [id]/status/route.ts     # Live status + progress
│   │   │   └── [id]/export/route.ts     # Data export (CSV/JSON)
│   │   └── chat/route.ts               # Analysis chat agent endpoint
│   ├── dashboard/
│   │   ├── layout.tsx                    # Session gate + nav
│   │   ├── page.tsx                      # Overview dashboard
│   │   ├── admin/page.tsx                # Admin: whitelist manager
│   │   ├── library/
│   │   │   ├── dilemmas/page.tsx         # Browse/create/edit dilemmas
│   │   │   ├── values/page.tsx          # Browse/create/edit values systems
│   │   │   ├── techniques/page.tsx      # Browse/create/edit mental techniques
│   │   │   └── modifiers/page.tsx       # Browse/create/edit modifiers
│   │   ├── models/page.tsx              # Model config management
│   │   └── experiments/
│   │       ├── page.tsx                  # List experiments
│   │       ├── new/page.tsx             # Experiment builder (multi-step)
│   │       └── [id]/page.tsx            # Experiment detail: status, results, chat
│   ├── sign-in/page.tsx
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                               # shadcn components
│   ├── dashboard-nav.tsx
│   ├── whitelist-manager.tsx
│   ├── experiment-builder/               # Multi-step experiment config UI
│   ├── content-editor.tsx                # Markdown editor for values/techniques/etc
│   └── analysis-chat.tsx                 # Chat interface for data interrogation
├── lib/
│   ├── auth.ts
│   ├── auth-client.ts
│   ├── utils.ts
│   ├── db/
│   │   ├── index.ts
│   │   └── schema.ts                     # All table definitions
│   └── services/
│       ├── email.ts
│       ├── whitelist.ts
│       ├── experiment-runner.ts          # Orchestrates experiment execution
│       ├── prompt-builder.ts             # Assembles system/user prompts
│       ├── noise.ts                      # Paraphrasing + framing jitter
│       ├── model-caller.ts              # Unified interface to call any model provider
│       └── analysis-agent.ts            # Post-experiment analysis agent
├── scripts/
│   └── seed.ts
├── drizzle/
├── proxy.ts
├── drizzle.config.ts
└── components.json
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

See [DATA_MODEL.md](./DATA_MODEL.md) for full schema. Summary:

| Group          | Tables                                                                     |
|----------------|----------------------------------------------------------------------------|
| Auth           | `user`, `session`, `account`, `verification`, `allowed_email`              |
| Content        | `model_config`, `dilemma`, `values_system`, `mental_technique`, `modifier` |
| Experiment     | `experiment`, junction tables (5), `experiment_combo`                      |
| Results        | `judgment`                                                                 |

### Migration Workflow

```bash
pnpm db:generate   # Generate SQL from schema changes
pnpm db:migrate    # Apply migrations to Neon
pnpm db:push       # Push schema directly (dev shortcut)
pnpm db:studio     # Open Drizzle Studio GUI
```

## Key Systems

### Prompt Builder (`lib/services/prompt-builder.ts`)

Assembles the full system prompt and user prompt for each judgment call:

```
System prompt:
  1. Base role/context (varies by judgment_mode)
  2. Values system content (if selected)
  3. Mental technique(s) content (if selected)
  4. Modifier(s) content (if selected)
  5. Tool definitions (for action/inquiry modes)

User prompt:
  1. Dilemma scenario (paraphrased for noise variants)
  2. Framing preamble (randomized)
```

### Noise Generator (`lib/services/noise.ts`)

Ensures judgments measure real model behavior, not token-sequence artifacts:

- `noise_index = 0`: original text, no modification (baseline)
- `noise_index > 0`: fast LLM paraphrases the dilemma (preserving all details) + randomized framing preamble
- Actual text sent is stored on the judgment row for reproducibility

### Model Caller (`lib/services/model-caller.ts`)

Unified interface for calling any supported model provider via AI SDK. Handles:

- Provider routing (Anthropic, OpenAI, Google, etc.)
- Tool call formatting (action mode, inquiry mode)
- Response parsing (extract choice, reasoning, confidence)
- Error categorization (transient → retry, refusal → record, fatal → fail)

### Experiment Runner (`lib/services/experiment-runner.ts`)

Orchestrates the full experiment lifecycle:

1. Computes the combinatorial matrix from experiment config
2. Creates all `judgment` rows with status `pending`
3. Executes in parallel with per-provider rate limiting
4. Retries transient errors (exponential backoff)
5. Records refusals as signal (status `refused`)
6. Updates `experiment.completed_count` continuously
7. Triggers analysis agent on completion

Runs as a durable workflow (Vercel/Cloudflare) to survive serverless timeouts.

### Analysis Agent (`lib/services/analysis-agent.ts`)

Two modes:

1. **Auto-analysis** — triggered automatically when experiment completes:
   - Runs text-to-SQL queries against judgment data
   - Performs statistical analysis in sandboxed code execution (E2B/Cloudflare)
   - Generates a markdown report with graphs, patterns, and hypotheses
   - Stores report in `experiment.analysis_report`
   - Sends email notification to experimenter

2. **Interactive chat** — available on the experiment detail page:
   - Researcher interrogates data via natural language
   - Agent has text-to-SQL access to the judgment data
   - Can run ad-hoc analysis code in sandbox
   - Conversation-based, builds on prior context

## Email Service

`lib/services/email.ts` wraps Resend behind a simple `sendEmail({ to, subject, html })` interface.

- **Development** (`NODE_ENV=development`): logs to console, no emails sent
- **Production**: sends via Resend using `FROM_EMAIL` env var

Used for: OTP codes, experiment completion notifications.

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
| `ANTHROPIC_API_KEY`  | Yes*     | For Claude models                  |
| `OPENAI_API_KEY`     | Yes*     | For OpenAI models                  |
| `GOOGLE_AI_API_KEY`  | Yes*     | For Gemini models                  |

*At least one model provider key required.

## Adding shadcn Components

```bash
pnpm dlx shadcn@latest add [component-name]
```

Components are installed as owned source code in `components/ui/`. The theme uses oklch colors with a clean, light academic feel (no dark mode).

# Authenticity Bench - Architecture

## Overview

A web application for running benchmarks across AI models to measure authenticity — honest, self-consistent behavior across different values systems, cognitive approaches, and situational pressures. Built with Next.js 16, deployed on Vercel, with invite-only access controlled via email whitelist.

## Stack

| Layer            | Technology                          |
|------------------|-------------------------------------|
| Framework        | Next.js 16 (App Router, Turbopack)  |
| Language         | TypeScript                          |
| Database         | Neon Postgres (Pool driver)         |
| ORM              | Drizzle ORM                         |
| Auth             | Better Auth 1.5                     |
| Email            | Resend                              |
| UI               | shadcn/ui, Tailwind CSS v4          |
| AI SDK           | Vercel AI SDK                       |
| Background Jobs  | Vercel WDK (Workflow Development Kit)|
| Code Execution   | Vercel Sandbox                      |
| Deployment       | Vercel                              |
| Package Mgr      | pnpm                                |

## Project Structure

```
authenticity-bench/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/route.ts        # Better Auth catch-all
│   │   ├── admin/whitelist/route.ts      # Whitelist CRUD (admin-only)
│   │   ├── admin/test-llm/route.ts      # LLM Playground API
│   │   ├── admin/test-workflow/route.ts  # WDK workflow test API
│   │   ├── admin/api-keys/route.ts      # API key management
│   │   ├── models/                       # Model config CRUD
│   │   ├── dilemmas/                     # Dilemma CRUD
│   │   ├── values/                       # Values system CRUD
│   │   ├── techniques/                   # Mental technique CRUD
│   │   ├── modifiers/                    # Modifier CRUD
│   │   ├── experiments/                  # Experiment CRUD + junction handling
│   │   └── generate/route.ts             # AI content generation endpoint
│   ├── admin/
│   │   ├── layout.tsx                    # Admin auth gate + admin sidebar
│   │   ├── page.tsx                      # Admin: whitelist manager
│   │   ├── api-keys/page.tsx             # API key management
│   │   ├── test-llm/page.tsx             # LLM Playground (test providers)
│   │   └── test-workflow/page.tsx         # WDK workflow test page
│   ├── dashboard/
│   │   ├── layout.tsx                    # Session gate + dashboard sidebar
│   │   ├── page.tsx                      # Overview dashboard
│   │   ├── experiments/
│   │   │   ├── page.tsx                  # Experiments list
│   │   │   ├── new/page.tsx              # 9-step experiment builder wizard
│   │   │   └── [id]/                     # Experiment detail (layout with tabs: Overview, Results, Judgments, Analysis, Export)
│   │   ├── analysis/
│   │   │   ├── page.tsx                  # Analysis chat list
│   │   │   └── [chatId]/page.tsx         # Chat interface (tools, model picker, share, export)
│   │   └── library/
│   │       ├── dilemmas/
│   │       │   ├── page.tsx              # List + create dilemmas
│   │       │   └── [id]/page.tsx         # Edit dilemma detail
│   │       ├── values/
│   │       │   ├── page.tsx              # List + create values systems
│   │       │   └── [id]/page.tsx         # Edit values detail
│   │       ├── techniques/
│   │       │   ├── page.tsx              # List + create techniques
│   │       │   └── [id]/page.tsx         # Edit technique detail
│   │       ├── modifiers/
│   │       │   ├── page.tsx              # List + create modifiers
│   │       │   └── [id]/page.tsx         # Edit modifier detail
│   │       └── models/
│   │           ├── page.tsx              # List + create models
│   │           └── [id]/page.tsx         # Edit model detail
│   ├── sign-in/page.tsx                  # Server component: redirects if signed in
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                               # shadcn components (incl. sidebar)
│   ├── analysis/
│   │   └── share-chat-dialog.tsx          # Share/unshare analysis chat dialog
│   ├── admin/
│   │   ├── admin-sidebar.tsx             # Admin sidebar (whitelist, API keys, LLM playground, workflow test)
│   │   └── admin-header.tsx              # Admin header with sidebar trigger
│   ├── dashboard/
│   │   ├── dashboard-sidebar.tsx         # Dashboard sidebar (library nav)
│   │   └── dashboard-header.tsx          # Dashboard header with sidebar trigger
│   ├── sidebar-user-badge.tsx            # User dropdown in sidebar footer
│   ├── sign-in-form.tsx                  # OTP sign-in form (client component)
│   ├── whitelist-manager.tsx
│   ├── content-list.tsx                  # Generic list with detail page links
│   ├── content-detail-page.tsx           # Shared edit/delete page for markdown entities
│   ├── markdown-content-form.tsx         # Shared create form for name+content+description entities
│   └── generate-dialog.tsx               # AI content generation dialog (any entity type)
├── hooks/
│   └── use-mobile.ts                     # Mobile breakpoint detection
├── lib/
│   ├── auth.ts                           # Better Auth server config
│   ├── auth-client.ts                    # Better Auth client
│   ├── utils.ts
│   ├── api/
│   │   ├── helpers.ts                    # Shared API utilities (auth, validation, responses)
│   │   └── schemas.ts                    # Zod schemas for all content entities
│   ├── db/
│   │   ├── index.ts                      # Drizzle + Neon connection
│   │   └── schema/
│   │       ├── auth.ts                   # Better Auth tables + allowed_email
│   │       ├── content.ts               # Content entity tables
│   │       ├── experiment.ts            # Experiment, junctions, combos, judgment
│   │       └── index.ts                 # Re-exports
│   └── services/
│       ├── email.ts                      # Resend wrapper (console.log in dev)
│       ├── whitelist.ts                  # Email/domain whitelist checker
│       ├── experiment/
│       │   └── combos.ts                # Power set generation + total judgment computation
│       ├── analysis/
│       │   ├── sandbox.ts               # Vercel Sandbox snapshot management
│       │   ├── context.ts               # Context windowing (token budget, message compression)
│       │   └── tools/                   # Agent tools (list_experiments, load_experiment, execute_python, viewimage)
│       ├── blob.ts                      # Vercel Blob wrapper for file storage
│       ├── prompts.ts                   # DB-backed prompt fetcher with cache
│       └── llm/
│           ├── index.ts                  # Barrel exports
│           ├── llm.ts                    # getModel, generateText, generateObject, streamText
│           ├── providers.ts             # Provider registry (Anthropic, OpenAI, Google, OpenRouter, Groq)
│           ├── api-key-store.ts         # DB-backed API key storage with AES encryption
│           ├── reasoning.ts             # Extended thinking config per provider
│           └── types.ts                 # LLMProvider, options, response types
├── workflows/
│   └── test-workflow.ts                  # WDK test workflow (validate, sleep, LLM call, parallel batch)
├── scripts/
│   ├── seed.ts                           # Seed admin whitelist + promote to admin
│   └── seed-models.ts                    # Seed 17 model configs from playground presets
├── drizzle/
├── proxy.ts                              # Next.js 16 proxy (protects /dashboard/*, /admin/*)
├── next.config.ts                        # Wrapped with withWorkflow() for WDK
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

- `proxy.ts` checks for session cookie on `/dashboard/*` and `/admin/*` routes, redirects to `/sign-in` if absent (edge/CDN level)
- `app/dashboard/layout.tsx` validates the session server-side and redirects if invalid (SSR level)
- `app/admin/layout.tsx` validates session + admin role, redirects non-admins to `/dashboard`

## Database

### Connection

Uses `@neondatabase/serverless` with the `Pool` driver (`neon-serverless`) — supports transactions, required for experiment creation. Schema is passed to the drizzle instance for relational queries.

### Tables

See [DATA_MODEL.md](./DATA_MODEL.md) for full schema. Summary:

| Group          | Tables                                                                     |
|----------------|----------------------------------------------------------------------------|
| Auth           | `user`, `session`, `account`, `verification`, `allowed_email`              |
| Content        | `model_config`, `dilemma`, `values_system`, `mental_technique`, `modifier` |
| Experiment     | `experiment`, 5 junction tables, `experiment_combo`                        |
| Results        | `judgment` (24 columns, 4 indexes)                                         |

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

### LLM Service (`lib/services/llm/`)

Unified interface for calling any supported model provider via Vercel AI SDK.

- **Provider registry** (`providers.ts`): Anthropic, OpenAI, Google, OpenRouter, Groq, Custom. Each provider maps to its AI SDK client factory.
- **Model routing** (`llm.ts`): Models use `"provider/model"` format (e.g. `"anthropic/claude-sonnet-4-6"`). The `getModel()` function extracts the provider prefix, resolves the API key from env, and returns an AI SDK `LanguageModel` instance.
- **Core functions**: `generateText()`, `generateObject()` (Zod schema → structured JSON), `streamText()`.
- **Reasoning** (`reasoning.ts`): Extended thinking config per provider — Anthropic budget tokens, OpenAI reasoning effort + summary, Google thinking levels, OpenRouter effort.
- **LLM Playground** (`/admin/test-llm`): Test any provider connection and response format without saving to DB. Supports text/structured modes, reasoning traces, and custom model IDs.
- **Integration with model_config table**: Benchmark runner constructs `${config.provider}/${config.modelId}` to route to the right provider. Temperature, topP, maxTokens come from the DB config.

### Experiment Runner (`lib/services/experiment-runner.ts`)

Orchestrates the full experiment lifecycle:

1. Computes the combinatorial matrix from experiment config
2. Creates all `judgment` rows with status `pending`
3. Executes in parallel with per-provider rate limiting
4. Retries transient errors (exponential backoff)
5. Records refusals as signal (status `refused`)
6. Updates `experiment.completed_count` continuously
7. Triggers analysis agent on completion

Runs as a durable Vercel WDK workflow to survive serverless timeouts. Uses `"use workflow"` and `"use step"` directives for automatic durability, retries, and background execution.

### Analysis Agent (`lib/services/analysis/`)

See [ANALYSIS.md](./ANALYSIS.md) for full design. Two levels:

1. **Auto-analysis** — triggered on experiment completion:
   - Exports experiment data to SQLite, uploads to Vercel Blob
   - Runs Python analysis in Vercel Sandbox (duckdb, pandas, matplotlib)
   - Generates markdown report stored in `experiment.analysis_report`

2. **Interactive chat** — top-level at `/dashboard/analysis/[chatId]`:
   - Persistent DB-backed conversations with tool execution
   - Agent tools: `list_experiments`, `load_experiment`, `execute_python`, `viewimage`
   - Sandbox with pre-installed packages (numpy, pandas, matplotlib, seaborn, scipy, scikit-learn, duckdb)
   - Generated files (charts, CSVs) uploaded to Vercel Blob for permanent URLs
   - Context windowing with message summarization for long conversations
   - Sharing, cloning, and JSON export

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

Admins manage the whitelist at `/admin` via the API at `/api/admin/whitelist` (GET/POST/DELETE, all admin-gated).

### Bootstrapping

1. Set `SEED_ADMIN_EMAIL` in `.env.local`
2. Run `pnpm db:seed` to add the email to the whitelist and promote to admin (if user already exists)
3. Sign in with that email
4. From then on, manage the whitelist from the admin UI

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
| `GOOGLE_API_KEY`     | No       | For Gemini models (direct API)     |
| `OPENROUTER_API_KEY` | No       | For OpenRouter gateway models      |
| `GROQ_API_KEY`       | No       | For Groq fast inference            |

*At least one model provider key required.

## Adding shadcn Components

```bash
pnpm dlx shadcn@latest add [component-name]
```

Components are installed as owned source code in `components/ui/`. The theme uses oklch colors with a clean, light academic feel (no dark mode).

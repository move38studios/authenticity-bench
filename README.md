# Authenticity Bench

A benchmark runner for evaluating how "authentic" LLMs are — measuring honest, self-consistent behavior across different values systems, cognitive approaches, and situational pressures.

See [docs/BIG_PICTURE.md](docs/BIG_PICTURE.md) for the full vision.

## Stack

Next.js 16 | TypeScript | Neon Postgres | Drizzle ORM | Better Auth | Vercel AI SDK | Vercel Sandbox | shadcn/ui | Vercel

## Getting Started

```bash
pnpm install
cp .env.local.example .env.local   # fill in your values
pnpm db:migrate
pnpm db:seed
pnpm db:seed-models
pnpm db:seed-prompts
pnpm dev
```

## Scripts

| Command                | Description                              |
|------------------------|------------------------------------------|
| `pnpm dev`             | Start dev server                         |
| `pnpm build`           | Production build                         |
| `pnpm db:generate`     | Generate SQL from schema changes         |
| `pnpm db:migrate`      | Apply migrations to Neon                 |
| `pnpm db:studio`       | Open Drizzle Studio GUI                  |
| `pnpm db:seed`         | Seed first admin email                   |
| `pnpm db:seed-models`  | Seed model configs from presets          |
| `pnpm db:seed-prompts` | Seed/update system prompts (upserts)     |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Analysis System](docs/ANALYSIS.md)
- [Big Picture](docs/BIG_PICTURE.md)
- [Data Model](docs/DATA_MODEL.md)
- [Development Plan](docs/DEVELOPMENT_PLAN.md)
- [Execution Engine](docs/EXECUTION_ENGINE.md)
- [Prompt Design](docs/PROMPT_DESIGN.md)

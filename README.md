# Authenticity Bench

A benchmark runner for evaluating how "authentic" LLMs are — measuring honest, self-consistent behavior across different values systems, cognitive approaches, and situational pressures.

See [docs/BIG_PICTURE.md](docs/BIG_PICTURE.md) for the full vision.

## Stack

Next.js 16 | TypeScript | Neon Postgres | Drizzle ORM | Better Auth | Resend | shadcn/ui | Vercel

## Getting Started

```bash
pnpm install
cp .env.local.example .env.local   # fill in your values
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Scripts

| Command            | Description                        |
|--------------------|------------------------------------|
| `pnpm dev`         | Start dev server                   |
| `pnpm build`       | Production build                   |
| `pnpm db:generate` | Generate SQL from schema changes   |
| `pnpm db:migrate`  | Apply migrations to Neon           |
| `pnpm db:push`     | Push schema directly (dev shortcut)|
| `pnpm db:studio`   | Open Drizzle Studio GUI            |
| `pnpm db:seed`     | Seed first admin email             |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Big Picture](docs/BIG_PICTURE.md)
- [Data Model](docs/DATA_MODEL.md)
- [Development Plan](docs/DEVELOPMENT_PLAN.md)

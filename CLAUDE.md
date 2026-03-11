# Project Rules

## Database Migrations

- **NEVER** write SQL migrations by hand or run raw SQL against the database
- **NEVER** use `db:push` — it is not part of our workflow
- **ALWAYS** use drizzle-kit for migrations:
  1. Edit the schema in `lib/db/schema/*.ts`
  2. Run `pnpm db:generate` to generate a migration file
  3. Run `pnpm db:migrate` to apply it
- If `db:migrate` fails, investigate and fix the root cause — do NOT bypass with raw SQL or `db:push`

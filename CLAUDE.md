# Project Rules

## Database Migrations

- **NEVER** write SQL migrations by hand or run raw SQL against the database
- **NEVER** use `db:push` — it is not part of our workflow
- **ALWAYS** use drizzle-kit for migrations:
  1. Edit the schema in `lib/db/schema/*.ts`
  2. Run `pnpm db:generate` to generate a migration file
  3. Run `pnpm db:migrate` to apply it
- If `db:migrate` fails, investigate and fix the root cause — do NOT bypass with raw SQL or `db:push`

## Zod Schemas

- **Keep Zod schemas simple** — do NOT use `.min()`, `.max()`, `.regex()`, `.length()`, or other refinement methods on schemas passed to LLM providers (e.g. `generateObject`). Many providers (Anthropic, etc.) reject JSON Schema properties like `minimum`, `maximum`, `pattern` that these produce.
- Use the `.describe()` string to communicate constraints to the model instead (e.g. "A number between 0 and 1")

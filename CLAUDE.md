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

## Mobile Responsiveness

- All dashboard pages must work on mobile. Header patterns with a heading + action button side-by-side should stack on mobile: use `space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between` and `w-full sm:w-auto` on buttons.
- Tab navigation that may overflow should use `overflow-x-auto scrollbar-none` with `whitespace-nowrap` on tab items.
- For chat pages, avoid multi-row headers on mobile. Use icon buttons and put less-frequent controls (like model picker) behind a settings dialog on mobile (`sm:hidden` cog button), while keeping them inline on desktop (`hidden sm:flex`).
- Use `scrollbar-none` utility class (defined in `globals.css`) for hidden scrollbars.

## Vercel Sandbox

- The sandbox runtime is Python 3.13. `sqlite3` C extension is NOT available — always use `duckdb` instead.
- File paths in `writeFiles`/`readFileToBuffer` are relative to `/vercel/sandbox/` (the working directory). Use relative paths like `data/file.db`, not absolute `/data/file.db`.
- Agent-generated files (charts, CSVs) should be saved to the working directory, not `/tmp`. The `execute_python` tool has a fallback that also checks `/tmp` since LLMs often default to it.

## AI SDK Tool Parts

- Tool parts in DB and in `UIMessage` must use `type: "tool-{toolName}"` format (e.g. `"tool-execute_python"`) with `state: "output-available"`, `input`, `output`.
- Do NOT use the old `type: "tool-invocation"` format with `args`/`result`/`state: "result"` — `convertToModelMessages` will fail with "Tool results are missing" errors.
- When loading messages from DB, normalize old-format parts via the `normalizeParts()` function in the messages route.

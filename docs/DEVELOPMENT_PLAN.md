# Development Plan

## Phase 1: Content Library ✓ COMPLETE

**Goal:** Researchers can create, edit, and browse all the raw materials needed to run experiments.

### Done

- Split schema: `lib/db/schema/auth.ts`, `content.ts`, `index.ts`
- All 5 content tables: `model_config`, `dilemma`, `values_system`, `mental_technique`, `modifier`
- CRUD API routes for all entities with Zod validation (`lib/api/schemas.ts`, `lib/api/helpers.ts`)
- Library UI: list pages with create forms + detail/edit pages at `[id]` URLs for all entities
- Delete confirmation via AlertDialog on all detail pages
- Reusable components: `content-list.tsx` (generic list with detail page links), `content-detail-page.tsx` (shared edit/delete for markdown entities), `markdown-content-form.tsx` (create form)
- AI-powered content generation: `generate-dialog.tsx` + `/api/generate` endpoint — generate dilemmas, values, techniques, or modifiers with any configured model
- Model seed script (`scripts/seed-models.ts`) — seeds 17 model configs from playground presets
- Sidebar navigation (shadcn sidebar pattern from steelframe): dashboard sidebar with library links + experiments, admin sidebar with separate layout at `/admin`
- Sign-in page redirects to dashboard if already authenticated
- LLM service layer (`lib/services/llm/`): multi-provider support via AI SDK — Anthropic, OpenAI, Google, OpenRouter. Includes `getModel()`, `generateText()`, `generateObject()`, `streamText()`, and extended reasoning config per provider (Anthropic budget tokens, OpenAI reasoning effort + summary, Google thinking levels).

---

## Phase 2: Experiment Configuration ✓ COMPLETE

**Goal:** Researchers can configure a benchmark run and see the combinatorial estimate before executing.

### Done

- Experiment schema: `experiment` table, 5 junction tables (`experiment_model_config`, `experiment_dilemma`, `experiment_values_system`, `experiment_mental_technique`, `experiment_modifier`), `experiment_combo`, `judgment` (24 columns, 4 indexes)
- Experiment CRUD API: `GET/POST /api/experiments`, `GET/PATCH/DELETE /api/experiments/[id]` with full junction/combo handling in transactions
- Combinatorial engine: `lib/services/experiment/combos.ts` — power set generation, total judgment computation
- 9-step experiment builder wizard at `/dashboard/experiments/new` (Basics → Models → Dilemmas → Modes → Values → Techniques → Modifiers → Repeats → Review) with live combinatorial total
- Experiments list page with status badges, judgment counts, progress

---

## Phase 3: Benchmark Execution (In progress)

**Goal:** Experiments can be run, with live progress tracking.

### 3a. Durable workflow infrastructure ✓ DONE

- Vercel WDK (`workflow` package) integrated — `next.config.ts` wrapped with `withWorkflow()`
- `workflows/test-workflow.ts` — test workflow with 4 steps (validate, sleep, LLM call, parallel batch) verified working end-to-end
- Admin test pages: `/admin/test-llm` (LLM Playground), `/admin/test-workflow` (WDK test)
- WDK auto-selects Local World (in-memory queue + `.workflow-data/` JSON files) in dev, Vercel World (Vercel Queues + cloud storage) in production

### 3b. Core engine

- `lib/services/experiment/workflow.ts` — WDK workflow definition for experiment execution
- `lib/services/experiment/planner.ts` — cartesian product generation, judgment row insertion
- `lib/services/experiment/executor.ts` — per-provider batch execution with concurrency control
- `lib/services/experiment/prompt-assembler.ts` — system/user prompt construction per mode
- `lib/services/experiment/response-parser.ts` — extract choice/reasoning from LLM responses
- `lib/services/experiment/paraphraser.ts` — scenario rewriting with noise injection
- `lib/services/experiment/cost-estimator.ts` — rough cost estimation
- See [EXECUTION_ENGINE.md](./EXECUTION_ENGINE.md) for full design

### 3c. Execution API

- `POST /api/experiments/[id]/run` — kicks off WDK workflow
- `GET /api/experiments/[id]/status` — returns progress (completed/total, ETA, errors)

### 3d. Live status UI

- `/dashboard/experiments/[id]` — shows experiment status: progress bar, completed/total, error count, ETA
- Auto-refreshes (polling or SSE)
- Experiment list page shows status badges

### Deliverable

Researcher can run an experiment, watch it progress, see errors. Results accumulate in the database.

---

## Phase 4: Results & Analysis

**Goal:** Researchers can understand experiment results through auto-generated reports and interactive chat.

### 4a. Auto-analysis agent

- `lib/services/analysis-agent.ts` — triggered on experiment completion
- Uses AI SDK to run an agent with:
  - Text-to-SQL tool (read-only queries against judgment data)
  - Sandboxed code execution (E2B or Cloudflare Containers) for statistical analysis + chart generation
- Produces a markdown report with:
  - Summary statistics (per model, per values system, per mode)
  - Self-coherence scores (noise variant agreement)
  - Notable patterns and outliers
  - Charts (choice distributions, confidence heatmaps, etc.)
  - Hypotheses for interpretation
- Stores report in `experiment.analysis_report`
- Sends email notification to experimenter

### 4b. Results UI

- `/dashboard/experiments/[id]` (results tab) — renders the analysis report
- Data export: download judgments as CSV or JSON
- Browse individual judgments with full prompt + response

### 4c. Interactive analysis chat

- Chat interface on the experiment page
- Agent has text-to-SQL access scoped to this experiment's data
- Can run ad-hoc code in sandbox for custom analysis
- Conversation history persisted per experiment

### Deliverable

Full loop: configure → run → get auto-analysis → dig deeper via chat → export data.

---

## Phase 5: Polish & Scale

**Goal:** Production readiness.

- Cost tracking and budget limits per experiment
- Model provider API key management in UI (encrypted storage)
- Experiment templates (save a config, re-run with different dilemmas)
- Comparison view: side-by-side results across experiments
- Public/private dilemma management (hide private dilemmas from public benchmark)
- Audit logging
- Performance optimization for large result sets
- Deploy to Vercel with proper env config

---

## Implementation Notes

### What to build vs. what to buy

- **Markdown editor**: use an existing React markdown editor component (e.g. @uiw/react-md-editor or similar)
- **Charts**: Recharts or similar, already works well with shadcn
- **Validation**: Zod for all request/response schema validation and structured model output parsing
- **AI SDK**: Vercel AI SDK for model calls — already supports Anthropic, OpenAI, Google
- **Code sandbox**: E2B (hosted) or Cloudflare Containers — don't build our own

### Schema management

Schema is split by domain from the start:

- `lib/db/schema/auth.ts` — user, session, account, verification, allowed_email (Better Auth tables)
- `lib/db/schema/content.ts` — model_config, dilemma, values_system, mental_technique, modifier
- `lib/db/schema/experiment.ts` — experiment, junction tables, experiment_combo, judgment
- `lib/db/schema/provider-key.ts` — encrypted API key storage per provider
- `lib/db/schema/index.ts` — re-exports everything

Drizzle config points at `./lib/db/schema` directory via glob.

### Validation

Zod is used for:

- API request body validation on all endpoints
- Structured response parsing from model calls
- Theory mode extraction (freeform → structured judgment)
- Experiment config validation before execution

### API patterns

- All API routes follow REST conventions with consistent JSON response shapes
- Zod schemas validate all request bodies
- Return JSON, use standard HTTP status codes
- Authenticated via Better Auth session (server-side `auth.api.getSession()`)
- Admin routes additionally check role
- Design routes with OpenAPI compatibility in mind: consistent resource naming, standard HTTP methods, typed request/response shapes. OpenAPI spec generation can be added later without refactoring (e.g. via next-swagger-doc or similar)

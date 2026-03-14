# Analysis System

How researchers explore, export, and interrogate experiment results — from quick auto-reports to deep multi-experiment analysis with an AI agent.

## Design Principles

1. **Live from the start**: All views work on incomplete experiments. No "wait until finished" gates.
2. **Progressive depth**: Auto-report → interactive chat → cross-experiment comparison. Each level goes deeper.
3. **Export-first**: Every view has a "download this" option. Researchers live in notebooks and spreadsheets.
4. **Top-level analysis**: Analysis is a first-class research activity, not an experiment property. Chats can span multiple experiments.
5. **Persistent everything**: Chat history, generated files, and charts are permanently stored. Nothing disappears when you close the tab.

---

## Architecture Overview

Analysis lives at two levels:

### Experiment-scoped (shallow)
- **Auto-report**: One-click generated markdown summary stored on `experiment.analysisReport`. Quick overview of results, refusal rates, consistency, notable patterns. No chat needed.
- **"Start Analysis" button**: Creates a new analysis chat with this experiment pre-loaded, then navigates to the chat page.

### Top-level (deep)
- **Analysis chats**: Full-featured AI agent conversations with persistent history, code execution, file generation, and multi-experiment support.
- **Chat list**: All your analysis chats in one place, searchable and resumable.

---

## URL Structure

```
/dashboard/analysis                      → Chat list (your analysis history)
/dashboard/analysis/[chatId]             → Chat interface

/dashboard/experiments/[id]              → Overview (unchanged)
/dashboard/experiments/[id]/results      → Charts (unchanged)
/dashboard/experiments/[id]/judgments     → Table (unchanged)
/dashboard/experiments/[id]/analysis     → Auto-report + related chats + "Start Analysis" button
/dashboard/experiments/[id]/export       → Download data (unchanged)
```

### Navigation

**Dashboard sidebar** (top to bottom):
- Experiments
- **Analysis** ← new
- Content Library (dilemmas, values, techniques, modifiers, models)
- Admin (footer, admin-only)

**Experiment detail tabs**: Overview | Results | Judgments | Analysis | Export

---

## Database Schema

### New tables

```
analysis_chat
  id                        text PK
  user_id                   text FK → user, NOT NULL
  title                     text              — auto-generated or user-set
  loaded_experiments        jsonb DEFAULT '[]' — [{experimentId, blobUrl, name, loadedAt}]
  summary                   text              — rolling summary of dropped messages
  summary_tokens            integer           — token count of summary
  summary_up_to_message_id  text              — last message included in summary
  sharing_uuid              text UNIQUE
  sharing_enabled           boolean DEFAULT false
  created_at                timestamp NOT NULL DEFAULT now()
  updated_at                timestamp NOT NULL DEFAULT now()

  INDEX (user_id, updated_at)

analysis_chat_message
  id          text PK
  chat_id     text FK → analysis_chat, CASCADE, NOT NULL
  role        text NOT NULL              — 'user' | 'assistant'
  parts       jsonb NOT NULL             — AI SDK v6 parts array
  content     text                       — extracted plain text for search
  metadata    jsonb                      — {model, tokens: {prompt, completion}, timing}
  created_at  timestamp NOT NULL DEFAULT now()

  INDEX (chat_id, created_at)
```

### Existing tables (no changes)

- `experiment.analysisStatus` / `experiment.analysisReport` — used by auto-report (already implemented)
- `system_prompt` — stores `analysis_system` and `analysis_auto_report` prompts (already seeded)

---

## Agent Tools

The analysis agent gets 4 tools:

### `list_experiments`

Browse available experiments. Returns id, name, status, judgment counts, dates. Supports filtering by status. The agent uses this when the researcher asks "compare my recent experiments" or "load the one about medical dilemmas."

### `load_experiment`

Export an experiment's data to SQLite, upload to Vercel Blob, download into sandbox at `/data/{sanitized_name}.db`. Records the blob URL on the chat's `loaded_experiments` field. Can be called multiple times to load multiple experiments into the same session.

On subsequent chat turns, previously-loaded experiments are automatically re-downloaded to the sandbox from Blob (sandboxes are ephemeral per-request, but the data persists in Blob).

### `execute_python`

Run Python code in the sandbox. Adapted from the steelframe `executecode` pattern:

- **Input**: `code` (string), `outputFileNames` (optional string array — files the code will produce)
- **Execution**: Write code to sandbox, run it, capture stdout/stderr
- **Output files**: Read declared output files from sandbox, upload to Vercel Blob, return permanent URLs
- **Result**: `{ success, stdout, stderr, error, files: [{ fileName, url, contentType, size }] }`

No `__IMAGE__:base64` hack. Charts and files get proper permanent URLs stored in Blob.

Pre-installed packages: numpy, pandas, matplotlib, seaborn, scipy, scikit-learn, duckdb.

### `viewimage`

Inspect a generated chart so the agent can self-correct if the visualization looks wrong. Takes a URL, validates it's an image via HEAD request, returns metadata.

The actual image is injected into the LLM's context via `prepareStep` — between tool steps, the handler appends image URLs from tool results as user message content parts. This is how the agent "sees" its own charts. Without `prepareStep` injection, the agent only gets the URL text, not the pixels.

---

## File Storage

**Vercel Blob** (`@vercel/blob`) for all persistent files:

Two categories:

1. **SQLite exports**: Cached experiment data files.
   - Path: `analysis/data/{experimentId}/{hash}.db`
   - Re-used across chat turns and across chats analyzing the same experiment
   - Invalidated when experiment data changes (new judgments completed)

2. **Generated files**: Charts, CSVs, Excel files, etc. produced by `execute_python`.
   - Path: `analysis/files/{chatId}/{executionId}/{fileName}`
   - Permanent — persist across sessions, viewable in chat history

### Helper: `lib/services/blob.ts`

```
uploadAnalysisFile(buffer, path, contentType) → url
downloadAnalysisFile(url) → Buffer
```

---

## Chat API

### `POST /api/analysis/chat` — Create chat

Creates a new `analysis_chat` row. Optionally pre-loads an experiment.

```
Body: { experimentId?: string }
Returns: { id, title, loadedExperiments }
```

If `experimentId` is provided, immediately exports that experiment to SQLite, uploads to Blob, and records it in `loaded_experiments`.

### `GET /api/analysis/chat` — List chats

User's analysis chats ordered by `updated_at desc`. Includes loaded experiment names.

### `GET /api/analysis/chat/[chatId]` — Get chat + messages

Chat metadata + all messages (parts in AI SDK v6 format). Used to hydrate the conversation on page load.

### `POST /api/analysis/chat/[chatId]/messages` — Send message (streaming)

The main chat endpoint. Flow:

1. **Auth** — verify user owns this chat (or has sharing access)
2. **Load messages** from DB
3. **Context windowing** — if over budget:
   - Drop oldest messages (keep last 4+)
   - Summarize dropped messages → store in `chat.summary`
   - Inject summary into system prompt
   - Compress large tool outputs in older messages
4. **Sandbox setup** — create from snapshot, download all `loaded_experiments` SQLite files from Blob
5. **System prompt** — fetch `analysis_system` from DB, append loaded experiment schemas + summary context
6. **Stream** with `streamText`:
   - Tools: `list_experiments`, `load_experiment`, `execute_python`, `viewimage`
   - `prepareStep`: inject image URLs from tool results so LLM sees charts
   - `onFinish`: persist user + assistant messages to DB, update `chat.updated_at`
7. **Cleanup** — stop sandbox

### `DELETE /api/analysis/chat/[chatId]` — Delete chat

### `PATCH /api/analysis/chat/[chatId]` — Update chat

Rename title, toggle sharing.

---

## Message Persistence

Adapted from steelframe's `onFinish` handler:

### Saving (on stream finish)

1. Save user message (the one that triggered this turn)
2. Parse `response.messages` to reconstruct assistant parts:
   - Text parts → `{ type: "text", text }`
   - Reasoning parts → `{ type: "reasoning", text }`
   - Tool calls + results merged → `{ type: "tool-{toolName}", toolCallId, state: "output-available", input, output }`
3. Save single combined assistant message with all parts
4. Extract plain text for `content` column (search)
5. Save metadata: model, token counts

### Loading (on page mount / new turn)

1. Query `analysis_chat_message` by `chat_id` ordered by `created_at`
2. Transform to AI SDK v6 `UIMessage[]` (id, role, parts)
3. Pass to `useChat` and to `streamText`

---

## Context Windowing

Simplified version of steelframe's approach:

1. **Budget**: estimate tokens from all messages (~4 chars ≈ 1 token)
2. **Threshold**: model context minus system prompt minus safety margin (~120k for Sonnet)
3. **When over budget**:
   - Keep most recent 4+ messages intact
   - Summarize dropped messages using Haiku → store on `chat.summary`
   - On next turn, inject into system prompt: "Previous conversation summary: {summary}"
4. **Tool output compression**: In older messages (not the last 2 turns), replace large stdout/stderr with short summaries like "[executed Python: queried judgment table, 45 rows returned]"

---

## UI

### Chat List Page (`/dashboard/analysis`)

- List of analysis chats: title, loaded experiments (badges), last activity
- "New Chat" button (top right)
- Click row → navigate to `/dashboard/analysis/[chatId]`

### Chat Page (`/dashboard/analysis/[chatId]`)

Full chat interface:
- **Header**: editable title, sharing toggle, loaded experiments as badges
- **Messages**: scrollable list
  - User messages: right-aligned, primary color
  - Assistant messages: left-aligned, muted background
  - Tool calls: collapsible cards (code + output + files)
  - Generated files: image previews inline, other files as download cards
- **Input**: textarea, Enter to send, Shift+Enter for newline
- **Suggestions**: on empty chat, show starter questions

### Experiment Analysis Tab (`/dashboard/experiments/[id]/analysis`)

Two sections:

1. **Auto-report** (unchanged):
   - "Run Analysis" / "Regenerate" button
   - Rendered markdown report
   - Status indicator

2. **Analysis chats** (new):
   - List of chats that have this experiment loaded
   - Title, date, message count per row
   - "Start New Analysis" button → creates chat, pre-loads experiment, navigates to `/dashboard/analysis/[newId]`

### Tool Result Rendering

**`execute_python`:**
- Collapsible code block (collapsed by default)
- Success/error indicator
- stdout as pre-formatted text
- stderr in warning style
- Generated files:
  - Images (png, jpg, svg): inline preview, click to expand
  - Data files (csv, xlsx, json): download card with filename + size
  - Other: generic download card

**`viewimage`:** Image preview card with URL and metadata

**`list_experiments` / `load_experiment`:** Simple text summary

---

## Implementation Plan

### Phase A: Schema + Blob storage

1. Add `analysisChat` and `analysisChatMessage` tables to `lib/db/schema/analysis-chat.ts`
2. Export from `lib/db/schema/index.ts`
3. `pnpm db:generate && pnpm db:migrate`
4. `pnpm add @vercel/blob`
5. Create `lib/services/blob.ts`

### Phase B: Agent tools

1. Create `lib/services/analysis/tools/execute-python.ts` — outputFileNames + Blob upload
2. Create `lib/services/analysis/tools/viewimage.ts` — URL validation
3. Create `lib/services/analysis/tools/list-experiments.ts` — query experiments
4. Create `lib/services/analysis/tools/load-experiment.ts` — export → Blob → sandbox
5. Create `lib/services/analysis/sandbox.ts` — snapshot management

### Phase C: Chat API

1. `app/api/analysis/chat/route.ts` — GET list, POST create
2. `app/api/analysis/chat/[chatId]/route.ts` — GET, PATCH, DELETE
3. `app/api/analysis/chat/[chatId]/messages/route.ts` — POST streaming with tools + persistence
4. Message persistence in `onFinish` (steelframe pattern)
5. `prepareStep` image injection
6. Context windowing with summary

### Phase D: UI

1. Add "Analysis" to dashboard sidebar
2. Create `/dashboard/analysis` — chat list page
3. Create `/dashboard/analysis/[chatId]` — chat page with message loading, `useChat`, tool rendering, file cards
4. Update `/dashboard/experiments/[id]/analysis` — keep auto-report, add chat list + "Start New Analysis" button

### Phase E: Refinements

1. Update `analysis_system` prompt for new tool set
2. Auto-generate chat titles after first exchange (background Haiku call)
3. Sharing UI (toggle + copy link)
4. Tool output compression for older messages

### What changes from current (Phase 1-3) implementation

**Keep as-is:**
- Auto-report on experiment page (`POST /api/experiments/[id]/analysis`)
- `exportExperimentToSQLite` function (reused by `load_experiment` tool)
- Seeded prompts (`analysis_system`, `analysis_auto_report`)
- SQLite export in export tab

**Replace:**
- `app/api/experiments/[id]/analysis/chat/route.ts` → new top-level `app/api/analysis/chat/[chatId]/messages/route.ts`
- `app/dashboard/experiments/[id]/analysis/page.tsx` → simplified to auto-report + chat links; full chat moves to `/dashboard/analysis/[chatId]`
- `execute_python` tool → upgraded with `outputFileNames` + Blob storage
- Ephemeral chats → persistent DB-backed conversations

**New:**
- `analysis_chat` + `analysis_chat_message` tables
- Vercel Blob integration
- `viewimage`, `list_experiments`, `load_experiment` tools
- Context windowing
- Chat list page
- Sharing

---

## Existing Data Interaction (unchanged)

The Results, Judgments, and Export tabs on the experiment detail page remain as-is:

### Results Tab (`/results`)
Aggregate charts: choice distribution, refusal breakdown, confidence, values system effect, noise consistency, mode comparison. Recharts, pulls from stats endpoint.

### Judgments Tab (`/judgments`)
Filterable, sortable table of all judgment rows. Click-through to full prompt/response detail.

### Export Tab (`/export`)
Download as CSV, JSON, JSONL, or SQLite. Field selection, status filtering, full-response toggle.

### Live Data Considerations
- Stats endpoint always computes from current data, no stale caching
- Charts show "N of M judgments completed" indicator
- Export downloads whatever matches current filters
- Auto-analysis can be triggered on partial data; report notes what fraction was analyzed

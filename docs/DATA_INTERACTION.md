# Data Interaction Plan

How researchers explore, export, and interrogate experiment results — including while experiments are still running.

## Design Principles

1. **Live from the start**: All views work on incomplete experiments. No "wait until finished" gates. If 3 of 16 judgments are done, you see those 3.
2. **Progressive depth**: Overview → table → individual judgment → agent chat. Each level goes deeper.
3. **Export-first**: Every view has a "download this" option. Researchers live in notebooks and spreadsheets — make it easy to get data out.
4. **Scoped agent**: The analysis chat agent can only read this experiment's data. No cross-experiment leakage, no writes.

---

## URL Structure

All data interaction lives under the existing experiment detail page, using tabs:

```
/dashboard/experiments/[id]              → Overview tab (current page — status, progress, config)
/dashboard/experiments/[id]/results      → Results tab — aggregate view + charts
/dashboard/experiments/[id]/judgments    → Judgments tab — browsable table of all judgment rows
/dashboard/experiments/[id]/judgments/[judgmentId] → Single judgment detail (full prompt, response, extraction)
/dashboard/experiments/[id]/analysis     → Analysis tab — auto-generated report + chat agent
/dashboard/experiments/[id]/export       → Export tab — download data in various formats
```

### Navigation

Tab bar on the experiment detail page: **Overview | Results | Judgments | Analysis | Export**

All tabs are always visible regardless of experiment status. Tabs that have no data yet show an appropriate empty state (e.g., "No judgments yet — experiment is still in draft").

---

## API Endpoints

### Judgments API

```
GET /api/experiments/[id]/judgments
  ?status=completed,refused,error     (filter by status, comma-separated)
  ?modelConfigId=xxx                  (filter by model)
  ?dilemmaId=xxx                      (filter by dilemma)
  ?valuesSystemId=xxx                 (filter, "null" for baseline)
  ?judgmentMode=theory                (filter by mode)
  ?choice=slug                        (filter by chosen option)
  ?refusalType=hard,soft              (filter by refusal type)
  ?sort=createdAt                     (sort field)
  ?order=asc|desc                     (sort direction)
  ?page=1&limit=50                    (pagination)

  Returns: paginated list with total count + judgment rows (excluding large fields like conversationLog, rawResponse)

GET /api/experiments/[id]/judgments/[judgmentId]
  Returns: full judgment row including conversationLog, rawResponse, systemPrompt, userPrompt

GET /api/experiments/[id]/judgments/stats
  Returns: aggregate statistics (counts by model, by choice, by refusal type, by mode, avg confidence, etc.)
  Used by the Results tab for charts.
```

### Export API

```
GET /api/experiments/[id]/export
  ?format=csv|json|jsonl              (output format)
  ?fields=id,choice,confidence,...    (optional field selection)
  ?status=completed                   (same filters as judgments endpoint)

  Returns: streaming download with Content-Disposition header
```

### Analysis API

```
POST /api/experiments/[id]/analysis/run
  Triggers auto-analysis agent. Can be re-run manually.

GET /api/experiments/[id]/analysis
  Returns: analysis report markdown + status

POST /api/experiments/[id]/analysis/chat
  Body: { message: string, conversationId?: string }
  Returns: streamed agent response (AI SDK useChat compatible)

GET /api/experiments/[id]/analysis/chat/[conversationId]
  Returns: conversation history
```

---

## Tab Details

### Results Tab (`/results`)

Aggregate view with charts. Works on partial data — charts update as judgments complete.

**Sections:**
- **Choice Distribution**: Bar chart — how many times each option was chosen, grouped by model. Shows the core signal.
- **Refusal Breakdown**: Stacked bar chart — none/hard/soft/conditional by model. Are some models more cautious?
- **Confidence Distribution**: Box plot or violin — confidence spread per model. Are some models more hedgy?
- **Values System Effect**: Grouped bar — choice distribution with vs. without each values system. Did values shift behavior?
- **Noise Consistency**: Per-model metric — how often the same model+config chose the same option across noise variants. Self-coherence score.
- **Mode Comparison**: When multiple modes are tested — does theory choice match action choice? The core authenticity question.

**Tech**: Recharts for charts. Stats endpoint provides pre-aggregated data. Client renders.

### Judgments Tab (`/judgments`)

Browsable, filterable, sortable table of all judgment rows.

**Columns**: Status, Model, Dilemma, Mode, Choice, Refusal Type, Confidence, Latency, Cost, Noise Index
**Filters**: Dropdowns for each dimension (model, dilemma, mode, values system, refusal type, status)
**Row click**: Opens judgment detail page

**Judgment Detail Page** (`/judgments/[judgmentId]`):
- Full system prompt and user prompt (collapsible)
- Model response (raw text or tool call transcript)
- For theory mode: raw response + extraction result side-by-side
- For inquiry-to-action: full multi-turn conversation with tool calls and responses
- Metadata: tokens, latency, cost, timestamps

### Analysis Tab (`/analysis`)

Two sections:

1. **Auto-generated Report**: Markdown rendered report produced by the analysis agent after experiment completion. Can be manually triggered for partial results too. Shows summary statistics, notable patterns, hypotheses.

2. **Interactive Chat**: Chat interface where the researcher can ask follow-up questions. The agent has:
   - Read-only SQL access scoped to this experiment's judgments
   - Ability to compute statistics and generate charts on the fly
   - Context about the experiment config and what the dimensions mean

### Export Tab (`/export`)

Simple page with:
- Format selector (CSV, JSON, JSONL)
- Field picker (checkboxes for which columns to include)
- Filter summary (same filters as judgments tab, pre-applied if navigated from filtered view)
- "Include full responses" toggle (adds conversationLog and rawResponse — makes files much larger)
- Download button
- Preview of first 5 rows

---

## Build Order

### Phase 4a: Judgments API + Table (foundation)

Build the data layer first — everything else depends on it.

1. `GET /api/experiments/[id]/judgments` with filtering, sorting, pagination
2. `GET /api/experiments/[id]/judgments/[judgmentId]` full detail
3. `GET /api/experiments/[id]/judgments/stats` aggregations
4. Judgments tab: filterable table with pagination
5. Judgment detail page: full prompt/response viewer
6. Tab navigation on experiment detail page

### Phase 4b: Results + Charts

1. Results tab with Recharts visualizations
2. Charts pull from stats endpoint
3. Live-updating: charts refresh when polling detects new completed judgments

### Phase 4c: Export

1. Export API with streaming CSV/JSON/JSONL
2. Export tab UI with field picker and format selector

### Phase 4d: Analysis Agent

1. Auto-analysis trigger on experiment completion
2. Analysis report rendering
3. Interactive chat with scoped SQL access
4. Chat conversation persistence

---

## Live Data Considerations

Since all views must work on incomplete experiments:

- **Stats endpoint**: Always computes from current data. No caching that goes stale.
- **Charts**: Show a "N of M judgments completed" indicator. Charts are accurate for what's done, not projections.
- **Table**: Default sort by `createdAt desc` so newest results appear first. Status filter defaults to "all" so researchers can see pending/running rows too.
- **Export**: Exports whatever matches the current filters. A "completed only" filter is the default for export but can be changed.
- **Analysis**: Auto-analysis runs on completion, but a "Run Analysis Now" button lets researchers trigger it on partial data. Report shows clearly what fraction of data was analyzed.

# Data Model

## Entity Relationship Overview

```
model_config ──┐
dilemma ───────┤
values_system ─┼──> experiment ──> judgment
mental_technique┤
modifier ──────┘
```

An `experiment` selects from each entity pool. The execution engine computes the full combinatorial matrix and produces `judgment` rows.

---

## Content Entities

These are created by researchers before experiments. They form the "library" of reusable materials.

### model_config

A specific model + parameter set. Same model at two temperatures = two separate configs.

```sql
CREATE TABLE model_config (
  id            TEXT PRIMARY KEY,
  provider      TEXT NOT NULL,           -- 'anthropic', 'openai', 'google', etc.
  model_id      TEXT NOT NULL,           -- 'claude-opus-4-6', 'gpt-4o', etc.
  display_name  TEXT NOT NULL,           -- 'Claude Opus 4.6 (t=0.7)'
  temperature   REAL NOT NULL DEFAULT 1.0,
  top_p         REAL,
  max_tokens    INTEGER NOT NULL DEFAULT 4096,
  extra_params  JSONB,                   -- provider-specific overrides
  created_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);
```

### dilemma

A scenario the model must respond to. Mode-agnostic in its core text — the judgment_mode determines how it's presented.

```sql
CREATE TABLE dilemma (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  scenario      TEXT NOT NULL,           -- the main scenario text (markdown)
  domain        TEXT,                    -- 'medical', 'military', 'business', 'personal', etc.
  tags          TEXT[] NOT NULL DEFAULT '{}',
  options       JSONB NOT NULL,          -- array of structured DilemmaOption objects (see below)
  is_public     BOOLEAN NOT NULL DEFAULT true,
  inquiry_tools JSONB,                   -- array of {name, description, parameters, response} for inquiry mode
  created_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);
```

Each option is a structured object with an embedded action tool. There is no separate `action_tool` column — each option IS an action tool. This ensures 1:1 mapping between theory-mode choices and action-mode tool calls, enabling clean theory-vs-action comparison.

**`options`** example:
```json
[
  {
    "slug": "freeze_account",
    "label": "Freeze the account",
    "description": "Immediately freeze the employee's reimbursement account pending investigation",
    "actionTool": {
      "name": "freeze_account",
      "description": "Immediately freeze the employee's reimbursement account pending investigation"
    }
  },
  {
    "slug": "flag_for_review",
    "label": "Flag for review",
    "description": "Flag the reports but allow reimbursement to continue pending human review",
    "actionTool": {
      "name": "flag_for_review",
      "description": "Flag the expense reports for compliance review without disrupting reimbursement"
    }
  }
]
```

**`inquiry_tools`** example:
```json
[
  {
    "name": "check_expense_history",
    "description": "Review the employee's full expense report history",
    "parameters": {
      "type": "object",
      "properties": {
        "time_range": { "type": "string", "description": "Time period to review" }
      }
    },
    "response": "Over the past 18 months, the employee submitted 42 expense reports totaling $28,400..."
  }
]
```

### values_system

A complete values framework document. "None" (no values injection) is implicit — stored as a null reference on the judgment, not as a row.

```sql
CREATE TABLE values_system (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,           -- 'Utilitarian', 'Kantian Deontology', 'Extreme Selfishness'
  content       TEXT NOT NULL,           -- full markdown document
  description   TEXT,                    -- short summary for UI display
  created_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);
```

### mental_technique

A thinking approach injected into the system prompt. Can be combined with others.

```sql
CREATE TABLE mental_technique (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,           -- 'Contemplative Introspection', 'Self-Debate'
  content       TEXT NOT NULL,           -- markdown instructions
  description   TEXT,
  created_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);
```

### modifier

A prompt modifier that changes perceived stakes or dynamics. Can be combined with others.

```sql
CREATE TABLE modifier (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,           -- 'Time Pressure', 'Evaluation Threat'
  content       TEXT NOT NULL,           -- the text injected into the prompt
  description   TEXT,
  created_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## Experiment Entities

### experiment

A configured and (optionally) executed benchmark run.

```sql
CREATE TABLE experiment (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'running', 'paused', 'completed', 'failed'
  judgment_modes  JSONB NOT NULL,                 -- ["theory", "single-shot-action", "inquiry-to-action"]
  noise_repeats   INTEGER NOT NULL DEFAULT 3,     -- number of paraphrase variants per config
  -- computed at config time, stored for reference
  total_judgments  INTEGER,                        -- estimated total
  -- execution tracking
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMP,
  finished_at     TIMESTAMP,
  -- analysis
  analysis_status TEXT DEFAULT 'pending',          -- 'pending', 'running', 'completed', 'failed'
  analysis_report TEXT,                            -- markdown report from analysis agent
  created_by      TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
```

### experiment junction tables

Many-to-many selections for what's included in an experiment.

```sql
CREATE TABLE experiment_model_config (
  experiment_id    TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
  model_config_id  TEXT NOT NULL REFERENCES model_config(id) ON DELETE CASCADE,
  PRIMARY KEY (experiment_id, model_config_id)
);

CREATE TABLE experiment_dilemma (
  experiment_id  TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
  dilemma_id     TEXT NOT NULL REFERENCES dilemma(id) ON DELETE CASCADE,
  PRIMARY KEY (experiment_id, dilemma_id)
);

CREATE TABLE experiment_values_system (
  experiment_id     TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
  values_system_id  TEXT NOT NULL REFERENCES values_system(id) ON DELETE CASCADE,
  PRIMARY KEY (experiment_id, values_system_id)
);

CREATE TABLE experiment_mental_technique (
  experiment_id        TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
  mental_technique_id  TEXT NOT NULL REFERENCES mental_technique(id) ON DELETE CASCADE,
  PRIMARY KEY (experiment_id, mental_technique_id)
);

CREATE TABLE experiment_modifier (
  experiment_id  TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
  modifier_id    TEXT NOT NULL REFERENCES modifier(id) ON DELETE CASCADE,
  PRIMARY KEY (experiment_id, modifier_id)
);
```

### experiment_combo_config

Stores the experimenter's selected combinations for mental techniques and modifiers. Defaults to full power set, but the experimenter can prune via UI.

```sql
CREATE TABLE experiment_combo (
  id              TEXT PRIMARY KEY,
  experiment_id   TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
  combo_type      TEXT NOT NULL,          -- 'mental_technique' or 'modifier'
  item_ids        JSONB NOT NULL          -- ordered array of IDs in this combo, e.g. ["id1", "id2"]. Empty array = "none"
);
```

Example rows for 2 mental techniques (A, B) with full power set:
```
{ combo_type: "mental_technique", item_ids: [] }         -- none
{ combo_type: "mental_technique", item_ids: ["A"] }      -- A alone
{ combo_type: "mental_technique", item_ids: ["B"] }      -- B alone
{ combo_type: "mental_technique", item_ids: ["A", "B"] } -- A + B
```

---

## Judgment

The core output. One row per model call.

```sql
CREATE TABLE judgment (
  id                    TEXT PRIMARY KEY,
  experiment_id         TEXT NOT NULL REFERENCES experiment(id) ON DELETE CASCADE,
  dilemma_id            TEXT NOT NULL REFERENCES dilemma(id),
  model_config_id       TEXT NOT NULL REFERENCES model_config(id),
  values_system_id      TEXT REFERENCES values_system(id),             -- null = no values injected
  mental_technique_ids  JSONB NOT NULL DEFAULT '[]',                   -- array of IDs used in this judgment
  modifier_ids          JSONB NOT NULL DEFAULT '[]',                   -- array of IDs used in this judgment
  judgment_mode         TEXT NOT NULL,                                  -- 'theory', 'single-shot-action', 'inquiry-to-action'
  noise_index           INTEGER NOT NULL,                              -- 0..noise_repeats-1
  -- the actual prompt sent (for reproducibility)
  system_prompt         TEXT,                                           -- full assembled system prompt
  user_prompt           TEXT,                                           -- paraphrased dilemma text sent to model
  -- model response
  status                TEXT NOT NULL DEFAULT 'pending',               -- 'pending', 'running', 'completed', 'refused', 'error'
  choice                TEXT,                                           -- the action/choice the model made
  reasoning             TEXT,                                           -- the model's reasoning
  confidence            REAL,                                           -- 0-1 confidence score
  conversation_log      JSONB,                                          -- full message transcript (all turns, all roles)
  raw_response          JSONB,                                          -- the final assistant response (containing the choice)
  inquiry_tool_calls    JSONB,                                          -- structured summary of inquiry calls [{turn, name, params, responsePreview}]
  error_message         TEXT,                                           -- error or refusal message if applicable
  -- metrics (totals across all turns for multi-turn conversations)
  latency_ms            INTEGER,
  prompt_tokens         INTEGER,
  completion_tokens     INTEGER,
  reasoning_tokens      INTEGER,
  cost_estimate         REAL,                                           -- estimated cost in USD
  created_at            TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_judgment_experiment ON judgment(experiment_id);
CREATE INDEX idx_judgment_status ON judgment(experiment_id, status);
CREATE INDEX idx_judgment_model ON judgment(experiment_id, model_config_id);
CREATE INDEX idx_judgment_dilemma ON judgment(experiment_id, dilemma_id);
```

---

## Combinatorial Matrix

The total number of judgments for an experiment:

```
total = |dilemmas|
      × |models|
      × (|values_systems| + 1)          -- +1 for "no values" baseline
      × |mental_technique_combos|        -- power set, prunable
      × |modifier_combos|                -- power set, prunable
      × |judgment_modes|
      × noise_repeats
```

Example: 20 dilemmas, 3 models, 3 values (+1 none), 3 mental technique combos, 2 modifier combos, 2 modes, 5 repeats = 20 × 3 × 4 × 3 × 2 × 2 × 5 = **7,200 judgments**.

This is computed and shown to the experimenter before they hit run.

---

## Noise System

To ensure judgments reflect real model behavior (not token-sequence artifacts), each `noise_index` variant:

1. **Paraphrases the dilemma text** using a fast LLM (e.g. Haiku) with instructions to preserve all details, names, numbers, and options exactly while varying sentence structure and word choice.
2. **Randomizes the framing preamble** (e.g. "Consider the following scenario:" vs "Here is a situation for you to evaluate:" etc.)

The actual text sent is stored in `judgment.user_prompt` for reproducibility and post-hoc verification that meaning was preserved. `noise_index = 0` always uses the original unmodified dilemma text as the baseline.

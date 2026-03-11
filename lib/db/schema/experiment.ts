import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import {
  modelConfig,
  dilemma,
  valuesSystem,
  mentalTechnique,
  modifier,
} from "./content";

// =============================================================================
// EXPERIMENT
// =============================================================================

export const experiment = pgTable("experiment", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft, running, paused, completed, failed
  judgmentModes: jsonb("judgment_modes").notNull(), // ["theory", "single-shot-action", "inquiry-to-action"]
  noiseRepeats: integer("noise_repeats").notNull().default(3),
  // computed at config time
  totalJudgments: integer("total_judgments"),
  // execution tracking
  completedCount: integer("completed_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  // analysis
  analysisStatus: text("analysis_status").default("pending"), // pending, running, completed, failed
  analysisReport: text("analysis_report"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =============================================================================
// JUNCTION TABLES
// =============================================================================

export const experimentModelConfig = pgTable(
  "experiment_model_config",
  {
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiment.id, { onDelete: "cascade" }),
    modelConfigId: text("model_config_id")
      .notNull()
      .references(() => modelConfig.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.modelConfigId] })]
);

export const experimentDilemma = pgTable(
  "experiment_dilemma",
  {
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiment.id, { onDelete: "cascade" }),
    dilemmaId: text("dilemma_id")
      .notNull()
      .references(() => dilemma.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.dilemmaId] })]
);

export const experimentValuesSystem = pgTable(
  "experiment_values_system",
  {
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiment.id, { onDelete: "cascade" }),
    valuesSystemId: text("values_system_id")
      .notNull()
      .references(() => valuesSystem.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.valuesSystemId] })]
);

export const experimentMentalTechnique = pgTable(
  "experiment_mental_technique",
  {
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiment.id, { onDelete: "cascade" }),
    mentalTechniqueId: text("mental_technique_id")
      .notNull()
      .references(() => mentalTechnique.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.mentalTechniqueId] })]
);

export const experimentModifier = pgTable(
  "experiment_modifier",
  {
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiment.id, { onDelete: "cascade" }),
    modifierId: text("modifier_id")
      .notNull()
      .references(() => modifier.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.modifierId] })]
);

// =============================================================================
// EXPERIMENT COMBO CONFIG
// =============================================================================

export const experimentCombo = pgTable("experiment_combo", {
  id: text("id").primaryKey(),
  experimentId: text("experiment_id")
    .notNull()
    .references(() => experiment.id, { onDelete: "cascade" }),
  comboType: text("combo_type").notNull(), // 'mental_technique' or 'modifier'
  itemIds: jsonb("item_ids").notNull(), // ordered array of IDs, [] = "none"
});

// =============================================================================
// JUDGMENT
// =============================================================================

export const judgment = pgTable(
  "judgment",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiment.id, { onDelete: "cascade" }),
    dilemmaId: text("dilemma_id")
      .notNull()
      .references(() => dilemma.id),
    modelConfigId: text("model_config_id")
      .notNull()
      .references(() => modelConfig.id),
    valuesSystemId: text("values_system_id").references(() => valuesSystem.id),
    mentalTechniqueIds: jsonb("mental_technique_ids").notNull().default([]),
    modifierIds: jsonb("modifier_ids").notNull().default([]),
    judgmentMode: text("judgment_mode").notNull(), // theory, single-shot-action, inquiry-to-action
    noiseIndex: integer("noise_index").notNull(),
    // actual prompts sent
    systemPrompt: text("system_prompt"),
    userPrompt: text("user_prompt"),
    // model response
    status: text("status").notNull().default("pending"), // pending, running, completed, refused, error
    choice: text("choice"),
    reasoning: text("reasoning"),
    confidence: real("confidence"),
    rawResponse: jsonb("raw_response"),
    inquiryToolCalls: jsonb("inquiry_tool_calls"),
    errorMessage: text("error_message"),
    // metrics
    latencyMs: integer("latency_ms"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    costEstimate: real("cost_estimate"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_judgment_experiment").on(t.experimentId),
    index("idx_judgment_status").on(t.experimentId, t.status),
    index("idx_judgment_model").on(t.experimentId, t.modelConfigId),
    index("idx_judgment_dilemma").on(t.experimentId, t.dilemmaId),
  ]
);

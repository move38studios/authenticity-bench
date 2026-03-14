/**
 * Data Export Service
 *
 * Exports experiment data to a SQLite file for use by the analysis agent.
 * Builds denormalized tables so the agent can query without complex joins.
 */

import Database from "better-sqlite3";
import { db } from "@/lib/db";
import {
  experiment,
  judgment,
  experimentDilemma,
  experimentModelConfig,
  experimentValuesSystem,
  experimentMentalTechnique,
  experimentModifier,
} from "@/lib/db/schema/experiment";
import {
  dilemma,
  modelConfig,
  valuesSystem,
  mentalTechnique,
  modifier,
} from "@/lib/db/schema/content";
import { eq, inArray } from "drizzle-orm";

export async function exportExperimentToSQLite(
  experimentId: string
): Promise<Buffer> {
  // 1. Load experiment
  const exp = await db.query.experiment.findFirst({
    where: eq(experiment.id, experimentId),
  });
  if (!exp) throw new Error(`Experiment not found: ${experimentId}`);

  // 2. Load junction IDs
  const [dilemmaJunctions, modelJunctions, vsJunctions, mtJunctions, modJunctions] =
    await Promise.all([
      db.select({ id: experimentDilemma.dilemmaId }).from(experimentDilemma).where(eq(experimentDilemma.experimentId, experimentId)),
      db.select({ id: experimentModelConfig.modelConfigId }).from(experimentModelConfig).where(eq(experimentModelConfig.experimentId, experimentId)),
      db.select({ id: experimentValuesSystem.valuesSystemId }).from(experimentValuesSystem).where(eq(experimentValuesSystem.experimentId, experimentId)),
      db.select({ id: experimentMentalTechnique.mentalTechniqueId }).from(experimentMentalTechnique).where(eq(experimentMentalTechnique.experimentId, experimentId)),
      db.select({ id: experimentModifier.modifierId }).from(experimentModifier).where(eq(experimentModifier.experimentId, experimentId)),
    ]);

  const dilemmaIds = dilemmaJunctions.map((r) => r.id);
  const modelIds = modelJunctions.map((r) => r.id);
  const vsIds = vsJunctions.map((r) => r.id);
  const mtIds = mtJunctions.map((r) => r.id);
  const modIds = modJunctions.map((r) => r.id);

  // 3. Load content
  const [dilemmas, models, valuesSystems, techniques, modifiers, judgments] =
    await Promise.all([
      dilemmaIds.length ? db.select().from(dilemma).where(inArray(dilemma.id, dilemmaIds)) : Promise.resolve([]),
      modelIds.length ? db.select().from(modelConfig).where(inArray(modelConfig.id, modelIds)) : Promise.resolve([]),
      vsIds.length ? db.select().from(valuesSystem).where(inArray(valuesSystem.id, vsIds)) : Promise.resolve([]),
      mtIds.length ? db.select().from(mentalTechnique).where(inArray(mentalTechnique.id, mtIds)) : Promise.resolve([]),
      modIds.length ? db.select().from(modifier).where(inArray(modifier.id, modIds)) : Promise.resolve([]),
      db.select().from(judgment).where(eq(judgment.experimentId, experimentId)),
    ]);

  // Build lookup maps
  const dilemmaMap = new Map(dilemmas.map((d) => [d.id, d]));
  const modelMap = new Map(models.map((m) => [m.id, m]));
  const vsMap = new Map(valuesSystems.map((v) => [v.id, v]));
  const mtMap = new Map(techniques.map((t) => [t.id, t]));
  const modMap = new Map(modifiers.map((m) => [m.id, m]));

  // 4. Create SQLite database in memory
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = OFF");

  // Create tables
  sqlite.exec(`
    CREATE TABLE experiment (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      status TEXT,
      judgment_modes TEXT,
      noise_repeats INTEGER,
      total_judgments INTEGER,
      completed_count INTEGER,
      failed_count INTEGER,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT
    );

    CREATE TABLE dilemma (
      id TEXT PRIMARY KEY,
      title TEXT,
      scenario TEXT,
      domain TEXT,
      tags TEXT,
      options TEXT
    );

    CREATE TABLE model (
      id TEXT PRIMARY KEY,
      provider TEXT,
      model_id TEXT,
      display_name TEXT
    );

    CREATE TABLE values_system (
      id TEXT PRIMARY KEY,
      name TEXT,
      content TEXT,
      description TEXT
    );

    CREATE TABLE mental_technique (
      id TEXT PRIMARY KEY,
      name TEXT,
      content TEXT,
      description TEXT
    );

    CREATE TABLE modifier (
      id TEXT PRIMARY KEY,
      name TEXT,
      content TEXT,
      description TEXT
    );

    CREATE TABLE judgment (
      id TEXT PRIMARY KEY,
      experiment_id TEXT,
      dilemma_id TEXT,
      model_config_id TEXT,
      values_system_id TEXT,
      mental_technique_ids TEXT,
      modifier_ids TEXT,
      judgment_mode TEXT,
      noise_index INTEGER,
      status TEXT,
      refusal_type TEXT,
      choice TEXT,
      reasoning TEXT,
      confidence REAL,
      system_prompt TEXT,
      user_prompt TEXT,
      conversation_log TEXT,
      raw_response TEXT,
      inquiry_tool_calls TEXT,
      error_message TEXT,
      latency_ms INTEGER,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      reasoning_tokens INTEGER,
      cost_estimate REAL,
      created_at TEXT,
      -- denormalized fields
      model_name TEXT,
      model_provider TEXT,
      dilemma_title TEXT,
      values_system_name TEXT,
      technique_names TEXT,
      modifier_names TEXT
    );
  `);

  // 5. Insert experiment
  sqlite.prepare(`
    INSERT INTO experiment VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    exp.id, exp.name, exp.description,
    exp.status, JSON.stringify(exp.judgmentModes), exp.noiseRepeats,
    exp.totalJudgments, exp.completedCount, exp.failedCount,
    exp.startedAt?.toISOString() ?? null,
    exp.finishedAt?.toISOString() ?? null,
    exp.createdAt.toISOString(),
  );

  // 6. Insert content tables
  const insertDilemma = sqlite.prepare(`INSERT INTO dilemma VALUES (?, ?, ?, ?, ?, ?)`);
  for (const d of dilemmas) {
    insertDilemma.run(d.id, d.title, d.scenario, d.domain, JSON.stringify(d.tags), JSON.stringify(d.options));
  }

  const insertModel = sqlite.prepare(`INSERT INTO model VALUES (?, ?, ?, ?)`);
  for (const m of models) {
    insertModel.run(m.id, m.provider, m.modelId, m.displayName);
  }

  const insertVS = sqlite.prepare(`INSERT INTO values_system VALUES (?, ?, ?, ?)`);
  for (const v of valuesSystems) {
    insertVS.run(v.id, v.name, v.content, v.description);
  }

  const insertMT = sqlite.prepare(`INSERT INTO mental_technique VALUES (?, ?, ?, ?)`);
  for (const t of techniques) {
    insertMT.run(t.id, t.name, t.content, t.description);
  }

  const insertMod = sqlite.prepare(`INSERT INTO modifier VALUES (?, ?, ?, ?)`);
  for (const m of modifiers) {
    insertMod.run(m.id, m.name, m.content, m.description);
  }

  // 7. Insert judgments with denormalized fields
  const insertJudgment = sqlite.prepare(`
    INSERT INTO judgment VALUES (${Array(32).fill("?").join(", ")})
  `);

  const insertMany = sqlite.transaction(() => {
    for (const j of judgments) {
      const mtIdArr = (j.mentalTechniqueIds as string[]) ?? [];
      const modIdArr = (j.modifierIds as string[]) ?? [];
      const model = modelMap.get(j.modelConfigId);
      const dil = dilemmaMap.get(j.dilemmaId);
      const vs = j.valuesSystemId ? vsMap.get(j.valuesSystemId) : null;
      const techniqueNames = mtIdArr.map((id) => mtMap.get(id)?.name).filter(Boolean).join(", ");
      const modifierNames = modIdArr.map((id) => modMap.get(id)?.name).filter(Boolean).join(", ");

      insertJudgment.run(
        j.id, j.experimentId, j.dilemmaId, j.modelConfigId,
        j.valuesSystemId, JSON.stringify(mtIdArr), JSON.stringify(modIdArr),
        j.judgmentMode, j.noiseIndex, j.status, j.refusalType,
        j.choice, j.reasoning, j.confidence,
        j.systemPrompt, j.userPrompt,
        j.conversationLog ? JSON.stringify(j.conversationLog) : null,
        j.rawResponse ? JSON.stringify(j.rawResponse) : null,
        j.inquiryToolCalls ? JSON.stringify(j.inquiryToolCalls) : null,
        j.errorMessage,
        j.latencyMs, j.promptTokens, j.completionTokens, j.reasoningTokens,
        j.costEstimate, j.createdAt.toISOString(),
        // denormalized
        model?.displayName ?? null,
        model?.provider ?? null,
        dil?.title ?? null,
        vs?.name ?? null,
        techniqueNames || null,
        modifierNames || null,
      );
    }
  });
  insertMany();

  // 8. Export as buffer
  const buffer = Buffer.from(sqlite.serialize());
  sqlite.close();

  return buffer;
}

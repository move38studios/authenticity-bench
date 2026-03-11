/**
 * Planner
 *
 * Generates the full cartesian product of judgment configurations from an
 * experiment's config. Inserts all judgment rows as "pending" and generates
 * paraphrased scenario variants.
 */

import { db } from "@/lib/db";
import {
  experiment,
  experimentModelConfig,
  experimentDilemma,
  experimentValuesSystem,
  experimentCombo,
  judgment,
} from "@/lib/db/schema/experiment";
import { modelConfig, dilemma } from "@/lib/db/schema/content";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { batchParaphrase } from "./paraphraser";
import type { JudgmentMode } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface PlanResult {
  totalJudgments: number;
  judgmentsByProvider: Record<string, string[]>;
}

interface ExperimentConfig {
  id: string;
  judgmentModes: JudgmentMode[];
  noiseRepeats: number;
}

// =============================================================================
// LOAD EXPERIMENT CONFIG
// =============================================================================

async function loadExperimentConfig(experimentId: string) {
  // Load experiment
  const exp = await db.query.experiment.findFirst({
    where: eq(experiment.id, experimentId),
  });
  if (!exp) throw new Error(`Experiment ${experimentId} not found`);

  const config: ExperimentConfig = {
    id: exp.id,
    judgmentModes: exp.judgmentModes as JudgmentMode[],
    noiseRepeats: exp.noiseRepeats,
  };

  // Load selected model configs
  const modelJunctions = await db
    .select({ modelConfigId: experimentModelConfig.modelConfigId })
    .from(experimentModelConfig)
    .where(eq(experimentModelConfig.experimentId, experimentId));
  const modelConfigIds = modelJunctions.map((j) => j.modelConfigId);

  const models =
    modelConfigIds.length > 0
      ? await db
          .select()
          .from(modelConfig)
          .where(inArray(modelConfig.id, modelConfigIds))
      : [];

  // Load selected dilemmas
  const dilemmaJunctions = await db
    .select({ dilemmaId: experimentDilemma.dilemmaId })
    .from(experimentDilemma)
    .where(eq(experimentDilemma.experimentId, experimentId));
  const dilemmaIds = dilemmaJunctions.map((j) => j.dilemmaId);

  const dilemmas =
    dilemmaIds.length > 0
      ? await db
          .select()
          .from(dilemma)
          .where(inArray(dilemma.id, dilemmaIds))
      : [];

  // Load selected values systems (IDs only — content loaded lazily)
  const valuesJunctions = await db
    .select({ valuesSystemId: experimentValuesSystem.valuesSystemId })
    .from(experimentValuesSystem)
    .where(eq(experimentValuesSystem.experimentId, experimentId));
  const valuesSystemIds = valuesJunctions.map((j) => j.valuesSystemId);

  // Load combos
  const combos = await db
    .select()
    .from(experimentCombo)
    .where(eq(experimentCombo.experimentId, experimentId));

  const techniqueCombos = combos
    .filter((c) => c.comboType === "mental_technique")
    .map((c) => c.itemIds as string[]);
  const modifierCombos = combos
    .filter((c) => c.comboType === "modifier")
    .map((c) => c.itemIds as string[]);

  // Ensure at least one combo (empty = "none")
  if (techniqueCombos.length === 0) techniqueCombos.push([]);
  if (modifierCombos.length === 0) modifierCombos.push([]);

  return { config, models, dilemmas, valuesSystemIds, techniqueCombos, modifierCombos };
}

// =============================================================================
// PLAN
// =============================================================================

/**
 * Generate all judgment rows for an experiment.
 *
 * 1. Computes the cartesian product of all dimensions
 * 2. Paraphrases scenarios for noise variants
 * 3. Inserts all judgment rows as "pending"
 * 4. Returns judgment IDs grouped by provider for parallel execution
 */
export async function planExperiment(
  experimentId: string
): Promise<PlanResult> {
  const { config, models, dilemmas, valuesSystemIds, techniqueCombos, modifierCombos } =
    await loadExperimentConfig(experimentId);

  // Generate paraphrased variants
  const paraphrases = await batchParaphrase(
    dilemmas.map((d) => ({ id: d.id, scenario: d.scenario })),
    config.noiseRepeats
  );

  // Values systems: include null baseline
  const valuesOptions: (string | null)[] = [null, ...valuesSystemIds];

  // Build judgment rows
  const rows: Array<typeof judgment.$inferInsert> = [];
  const judgmentsByProvider: Record<string, string[]> = {};

  for (const d of dilemmas) {
    for (const m of models) {
      for (const vs of valuesOptions) {
        for (const tc of techniqueCombos) {
          for (const mc of modifierCombos) {
            for (const mode of config.judgmentModes) {
              for (let ni = 0; ni < config.noiseRepeats; ni++) {
                const id = randomUUID();
                const paraphraseKey = `${d.id}:${ni}`;
                const provider = m.provider;

                if (!judgmentsByProvider[provider]) {
                  judgmentsByProvider[provider] = [];
                }
                judgmentsByProvider[provider].push(id);

                rows.push({
                  id,
                  experimentId,
                  dilemmaId: d.id,
                  modelConfigId: m.id,
                  valuesSystemId: vs,
                  mentalTechniqueIds: tc,
                  modifierIds: mc,
                  judgmentMode: mode,
                  noiseIndex: ni,
                  userPrompt: paraphrases.get(paraphraseKey) ?? d.scenario,
                  status: "pending",
                });
              }
            }
          }
        }
      }
    }
  }

  // Insert in batches of 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(judgment).values(batch);
  }

  // Update experiment
  await db
    .update(experiment)
    .set({
      status: "running",
      totalJudgments: rows.length,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(experiment.id, experimentId));

  return {
    totalJudgments: rows.length,
    judgmentsByProvider,
  };
}

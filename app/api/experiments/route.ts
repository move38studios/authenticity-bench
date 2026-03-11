import { db } from "@/lib/db";
import {
  experiment,
  experimentModelConfig,
  experimentDilemma,
  experimentValuesSystem,
  experimentMentalTechnique,
  experimentModifier,
  experimentCombo,
} from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  getSession,
  unauthorized,
  ok,
  parseBody,
} from "@/lib/api/helpers";
import { createExperimentSchema } from "@/lib/api/schemas";
import {
  powerSet,
  computeTotalJudgments,
} from "@/lib/services/experiment";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const rows = await db
    .select()
    .from(experiment)
    .orderBy(desc(experiment.createdAt));

  return ok(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, createExperimentSchema);
  if (!parsed.success) return parsed.response;

  const {
    name,
    description,
    judgmentModes,
    noiseRepeats,
    modelConfigIds,
    dilemmaIds,
    valuesSystemIds,
    mentalTechniqueIds,
    modifierIds,
    mentalTechniqueCombos,
    modifierCombos,
  } = parsed.data;

  const experimentId = randomUUID();

  // Generate combos: use provided or compute power set
  const mtCombos = mentalTechniqueCombos ?? powerSet(mentalTechniqueIds);
  const modCombos = modifierCombos ?? powerSet(modifierIds);

  // Ensure at least one combo (the empty set = "none")
  const finalMtCombos = mtCombos.length > 0 ? mtCombos : [[]];
  const finalModCombos = modCombos.length > 0 ? modCombos : [[]];

  const totalJudgments = computeTotalJudgments({
    dilemmaCount: dilemmaIds.length,
    modelCount: modelConfigIds.length,
    valuesSystemCount: valuesSystemIds.length,
    mentalTechniqueComboCount: finalMtCombos.length,
    modifierComboCount: finalModCombos.length,
    judgmentModeCount: judgmentModes.length,
    noiseRepeats,
  });

  // Insert everything in a transaction
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(experiment)
      .values({
        id: experimentId,
        name,
        description,
        judgmentModes,
        noiseRepeats,
        totalJudgments,
        createdBy: session.user.id,
      })
      .returning();

    // Junction tables
    if (modelConfigIds.length > 0) {
      await tx.insert(experimentModelConfig).values(
        modelConfigIds.map((id) => ({
          experimentId,
          modelConfigId: id,
        }))
      );
    }

    if (dilemmaIds.length > 0) {
      await tx.insert(experimentDilemma).values(
        dilemmaIds.map((id) => ({
          experimentId,
          dilemmaId: id,
        }))
      );
    }

    if (valuesSystemIds.length > 0) {
      await tx.insert(experimentValuesSystem).values(
        valuesSystemIds.map((id) => ({
          experimentId,
          valuesSystemId: id,
        }))
      );
    }

    if (mentalTechniqueIds.length > 0) {
      await tx.insert(experimentMentalTechnique).values(
        mentalTechniqueIds.map((id) => ({
          experimentId,
          mentalTechniqueId: id,
        }))
      );
    }

    if (modifierIds.length > 0) {
      await tx.insert(experimentModifier).values(
        modifierIds.map((id) => ({
          experimentId,
          modifierId: id,
        }))
      );
    }

    // Combo configs
    const comboRows = [
      ...finalMtCombos.map((ids) => ({
        id: randomUUID(),
        experimentId,
        comboType: "mental_technique" as const,
        itemIds: ids,
      })),
      ...finalModCombos.map((ids) => ({
        id: randomUUID(),
        experimentId,
        comboType: "modifier" as const,
        itemIds: ids,
      })),
    ];

    if (comboRows.length > 0) {
      await tx.insert(experimentCombo).values(comboRows);
    }

    return row;
  });

  return ok({ ...result, totalJudgments }, 201);
}

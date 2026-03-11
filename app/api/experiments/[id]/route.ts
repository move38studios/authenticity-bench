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
import { eq } from "drizzle-orm";
import {
  getSession,
  unauthorized,
  notFound,
  ok,
  badRequest,
  parseBody,
} from "@/lib/api/helpers";
import { updateExperimentSchema } from "@/lib/api/schemas";
import { randomUUID } from "crypto";
import {
  powerSet,
  computeTotalJudgments,
} from "@/lib/services/experiment";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  const rows = await db
    .select()
    .from(experiment)
    .where(eq(experiment.id, id))
    .limit(1);

  if (rows.length === 0) return notFound("Experiment");

  // Fetch related data
  const [models, dilemmas, values, techniques, modifiers, combos] =
    await Promise.all([
      db
        .select()
        .from(experimentModelConfig)
        .where(eq(experimentModelConfig.experimentId, id)),
      db
        .select()
        .from(experimentDilemma)
        .where(eq(experimentDilemma.experimentId, id)),
      db
        .select()
        .from(experimentValuesSystem)
        .where(eq(experimentValuesSystem.experimentId, id)),
      db
        .select()
        .from(experimentMentalTechnique)
        .where(eq(experimentMentalTechnique.experimentId, id)),
      db
        .select()
        .from(experimentModifier)
        .where(eq(experimentModifier.experimentId, id)),
      db
        .select()
        .from(experimentCombo)
        .where(eq(experimentCombo.experimentId, id)),
    ]);

  return ok({
    ...rows[0],
    modelConfigIds: models.map((m) => m.modelConfigId),
    dilemmaIds: dilemmas.map((d) => d.dilemmaId),
    valuesSystemIds: values.map((v) => v.valuesSystemId),
    mentalTechniqueIds: techniques.map((t) => t.mentalTechniqueId),
    modifierIds: modifiers.map((m) => m.modifierId),
    combos: combos.map((c) => ({
      id: c.id,
      comboType: c.comboType,
      itemIds: c.itemIds,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  // Only allow editing draft experiments
  const existing = await db
    .select()
    .from(experiment)
    .where(eq(experiment.id, id))
    .limit(1);

  if (existing.length === 0) return notFound("Experiment");
  if (existing[0].status !== "draft") {
    return badRequest("Can only edit draft experiments");
  }

  const parsed = await parseBody(request, updateExperimentSchema);
  if (!parsed.success) return parsed.response;

  const {
    modelConfigIds,
    dilemmaIds,
    valuesSystemIds,
    mentalTechniqueIds,
    modifierIds,
    mentalTechniqueCombos,
    modifierCombos,
    ...experimentFields
  } = parsed.data;

  await db.transaction(async (tx) => {
    // Update experiment fields
    if (Object.keys(experimentFields).length > 0) {
      await tx
        .update(experiment)
        .set({ ...experimentFields, updatedAt: new Date() })
        .where(eq(experiment.id, id));
    }

    // Replace junction tables if provided
    if (modelConfigIds !== undefined) {
      await tx
        .delete(experimentModelConfig)
        .where(eq(experimentModelConfig.experimentId, id));
      if (modelConfigIds.length > 0) {
        await tx.insert(experimentModelConfig).values(
          modelConfigIds.map((mcId) => ({ experimentId: id, modelConfigId: mcId }))
        );
      }
    }

    if (dilemmaIds !== undefined) {
      await tx
        .delete(experimentDilemma)
        .where(eq(experimentDilemma.experimentId, id));
      if (dilemmaIds.length > 0) {
        await tx.insert(experimentDilemma).values(
          dilemmaIds.map((dId) => ({ experimentId: id, dilemmaId: dId }))
        );
      }
    }

    if (valuesSystemIds !== undefined) {
      await tx
        .delete(experimentValuesSystem)
        .where(eq(experimentValuesSystem.experimentId, id));
      if (valuesSystemIds.length > 0) {
        await tx.insert(experimentValuesSystem).values(
          valuesSystemIds.map((vId) => ({ experimentId: id, valuesSystemId: vId }))
        );
      }
    }

    if (mentalTechniqueIds !== undefined) {
      await tx
        .delete(experimentMentalTechnique)
        .where(eq(experimentMentalTechnique.experimentId, id));
      if (mentalTechniqueIds.length > 0) {
        await tx.insert(experimentMentalTechnique).values(
          mentalTechniqueIds.map((mtId) => ({
            experimentId: id,
            mentalTechniqueId: mtId,
          }))
        );
      }
    }

    if (modifierIds !== undefined) {
      await tx
        .delete(experimentModifier)
        .where(eq(experimentModifier.experimentId, id));
      if (modifierIds.length > 0) {
        await tx.insert(experimentModifier).values(
          modifierIds.map((mId) => ({ experimentId: id, modifierId: mId }))
        );
      }
    }

    // Regenerate combos if technique/modifier selections changed
    if (mentalTechniqueCombos !== undefined || mentalTechniqueIds !== undefined ||
        modifierCombos !== undefined || modifierIds !== undefined) {
      await tx
        .delete(experimentCombo)
        .where(eq(experimentCombo.experimentId, id));

      // Get current technique and modifier IDs
      const effectiveMtIds = mentalTechniqueIds ??
        (await tx
          .select()
          .from(experimentMentalTechnique)
          .where(eq(experimentMentalTechnique.experimentId, id))
        ).map((r) => r.mentalTechniqueId);

      const effectiveModIds = modifierIds ??
        (await tx
          .select()
          .from(experimentModifier)
          .where(eq(experimentModifier.experimentId, id))
        ).map((r) => r.modifierId);

      const mtCombos = mentalTechniqueCombos ?? powerSet(effectiveMtIds);
      const modCombos = modifierCombos ?? powerSet(effectiveModIds);
      const finalMtCombos = mtCombos.length > 0 ? mtCombos : [[]];
      const finalModCombos = modCombos.length > 0 ? modCombos : [[]];

      const comboRows = [
        ...finalMtCombos.map((ids) => ({
          id: randomUUID(),
          experimentId: id,
          comboType: "mental_technique" as const,
          itemIds: ids,
        })),
        ...finalModCombos.map((ids) => ({
          id: randomUUID(),
          experimentId: id,
          comboType: "modifier" as const,
          itemIds: ids,
        })),
      ];

      if (comboRows.length > 0) {
        await tx.insert(experimentCombo).values(comboRows);
      }
    }

    // Recompute total judgments
    const [currentExp] = await tx
      .select()
      .from(experiment)
      .where(eq(experiment.id, id));

    const mtComboCount = (
      await tx
        .select()
        .from(experimentCombo)
        .where(eq(experimentCombo.experimentId, id))
    ).filter((c) => c.comboType === "mental_technique").length;

    const modComboCount = (
      await tx
        .select()
        .from(experimentCombo)
        .where(eq(experimentCombo.experimentId, id))
    ).filter((c) => c.comboType === "modifier").length;

    const dilemmaCount = (
      await tx
        .select()
        .from(experimentDilemma)
        .where(eq(experimentDilemma.experimentId, id))
    ).length;

    const modelCount = (
      await tx
        .select()
        .from(experimentModelConfig)
        .where(eq(experimentModelConfig.experimentId, id))
    ).length;

    const valuesCount = (
      await tx
        .select()
        .from(experimentValuesSystem)
        .where(eq(experimentValuesSystem.experimentId, id))
    ).length;

    const modes = (currentExp.judgmentModes ?? []) as string[];

    const totalJudgments = computeTotalJudgments({
      dilemmaCount,
      modelCount,
      valuesSystemCount: valuesCount,
      mentalTechniqueComboCount: mtComboCount || 1,
      modifierComboCount: modComboCount || 1,
      judgmentModeCount: modes.length,
      noiseRepeats: currentExp.noiseRepeats,
    });

    await tx
      .update(experiment)
      .set({ totalJudgments, updatedAt: new Date() })
      .where(eq(experiment.id, id));
  });

  // Return updated experiment with relations
  const [updated] = await db
    .select()
    .from(experiment)
    .where(eq(experiment.id, id));

  return ok(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const rows = await db
    .delete(experiment)
    .where(eq(experiment.id, id))
    .returning();

  if (rows.length === 0) return notFound("Experiment");
  return ok({ deleted: true });
}

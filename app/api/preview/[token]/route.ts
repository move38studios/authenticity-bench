import { db } from "@/lib/db";
import {
  experiment,
  experimentDilemma,
  experimentValuesSystem,
  experimentMentalTechnique,
  experimentModifier,
  experimentCombo,
  dilemma,
  valuesSystem,
  mentalTechnique,
  modifier,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { notFound, ok } from "@/lib/api/helpers";

/**
 * GET /api/preview/[token]
 *
 * Public (no auth). Returns the full experiment configuration needed
 * to render the preview: system prompt components, dilemmas with
 * options/inquiry tools, combo definitions.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rows = await db
    .select()
    .from(experiment)
    .where(eq(experiment.previewToken, token))
    .limit(1);

  if (rows.length === 0) return notFound("Preview");

  const exp = rows[0];

  // Fetch all related IDs and content in parallel
  const [
    dilemmaJunctions,
    valuesJunctions,
    techniqueJunctions,
    modifierJunctions,
    combos,
  ] = await Promise.all([
    db
      .select()
      .from(experimentDilemma)
      .where(eq(experimentDilemma.experimentId, exp.id)),
    db
      .select()
      .from(experimentValuesSystem)
      .where(eq(experimentValuesSystem.experimentId, exp.id)),
    db
      .select()
      .from(experimentMentalTechnique)
      .where(eq(experimentMentalTechnique.experimentId, exp.id)),
    db
      .select()
      .from(experimentModifier)
      .where(eq(experimentModifier.experimentId, exp.id)),
    db
      .select()
      .from(experimentCombo)
      .where(eq(experimentCombo.experimentId, exp.id)),
  ]);

  const dilemmaIds = dilemmaJunctions.map((d) => d.dilemmaId);
  const valuesIds = valuesJunctions.map((v) => v.valuesSystemId);
  const techniqueIds = techniqueJunctions.map((t) => t.mentalTechniqueId);
  const modifierIds = modifierJunctions.map((m) => m.modifierId);

  // Fetch actual content
  const [dilemmasData, valuesData, techniquesData, modifiersData] =
    await Promise.all([
      dilemmaIds.length > 0
        ? db
            .select()
            .from(dilemma)
            .where(inArray(dilemma.id, dilemmaIds))
        : Promise.resolve([]),
      valuesIds.length > 0
        ? db
            .select()
            .from(valuesSystem)
            .where(inArray(valuesSystem.id, valuesIds))
        : Promise.resolve([]),
      techniqueIds.length > 0
        ? db
            .select()
            .from(mentalTechnique)
            .where(inArray(mentalTechnique.id, techniqueIds))
        : Promise.resolve([]),
      modifierIds.length > 0
        ? db
            .select()
            .from(modifier)
            .where(inArray(modifier.id, modifierIds))
        : Promise.resolve([]),
    ]);

  return ok({
    experiment: {
      name: exp.name,
      description: exp.description,
      judgmentModes: exp.judgmentModes,
      noiseRepeats: exp.noiseRepeats,
      totalJudgments: exp.totalJudgments,
    },
    dilemmas: dilemmasData.map((d) => ({
      id: d.id,
      title: d.title,
      scenario: d.scenario,
      domain: d.domain,
      options: d.options,
      inquiryTools: d.inquiryTools,
    })),
    valuesSystems: valuesData.map((v) => ({
      id: v.id,
      name: v.name,
      content: v.content,
    })),
    mentalTechniques: techniquesData.map((t) => ({
      id: t.id,
      name: t.name,
      content: t.content,
    })),
    modifiers: modifiersData.map((m) => ({
      id: m.id,
      name: m.name,
      content: m.content,
    })),
    combos: combos.map((c) => ({
      comboType: c.comboType,
      itemIds: c.itemIds,
    })),
  });
}

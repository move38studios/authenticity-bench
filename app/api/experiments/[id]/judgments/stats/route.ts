import { db } from "@/lib/db";
import { judgment, experiment, experimentDilemma } from "@/lib/db/schema/experiment";
import { modelConfig, dilemma, valuesSystem } from "@/lib/db/schema/content";
import { eq, sql, and, inArray } from "drizzle-orm";
import { getSession, unauthorized, notFound, ok } from "@/lib/api/helpers";

/**
 * GET /api/experiments/[id]/judgments/stats
 *
 * Aggregate statistics for charts and summary views.
 * Supports ?dilemmaId=xxx to filter by dilemma.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  const exp = await db.query.experiment.findFirst({
    where: eq(experiment.id, id),
    columns: { id: true, totalJudgments: true, completedCount: true, failedCount: true },
  });
  if (!exp) return notFound("Experiment");

  // Parse dilemma filter
  const url = new URL(request.url);
  const dilemmaFilter = url.searchParams.get("dilemmaId");

  // Base condition: experiment + completed/refused
  const baseConditions = [
    eq(judgment.experimentId, id),
    inArray(judgment.status, ["completed", "refused"]),
  ];
  if (dilemmaFilter) baseConditions.push(eq(judgment.dilemmaId, dilemmaFilter));
  const baseWhere = and(...baseConditions);

  // All-status conditions (for byStatus query)
  const allConditions = [eq(judgment.experimentId, id)];
  if (dilemmaFilter) allConditions.push(eq(judgment.dilemmaId, dilemmaFilter));
  const allWhere = and(...allConditions);

  // Run all aggregation queries in parallel
  const [
    dilemmas,
    byStatus,
    byModel,
    byChoice,
    byRefusalType,
    byMode,
    byValuesSystem,
    confidenceStats,
    choiceByModel,
    choiceByValues,
  ] = await Promise.all([
    // Dilemma list for filter dropdown
    db
      .select({
        dilemmaId: experimentDilemma.dilemmaId,
        title: dilemma.title,
      })
      .from(experimentDilemma)
      .leftJoin(dilemma, eq(experimentDilemma.dilemmaId, dilemma.id))
      .where(eq(experimentDilemma.experimentId, id)),

    // Count by status
    db
      .select({
        status: judgment.status,
        count: sql<number>`count(*)`,
      })
      .from(judgment)
      .where(allWhere)
      .groupBy(judgment.status),

    // Count by model
    db
      .select({
        modelConfigId: judgment.modelConfigId,
        displayName: modelConfig.displayName,
        provider: modelConfig.provider,
        count: sql<number>`count(*)`,
        completedCount: sql<number>`count(*) filter (where ${judgment.status} in ('completed', 'refused'))`,
      })
      .from(judgment)
      .leftJoin(modelConfig, eq(judgment.modelConfigId, modelConfig.id))
      .where(allWhere)
      .groupBy(judgment.modelConfigId, modelConfig.displayName, modelConfig.provider),

    // Count by choice
    db
      .select({
        choice: judgment.choice,
        count: sql<number>`count(*)`,
      })
      .from(judgment)
      .where(baseWhere)
      .groupBy(judgment.choice),

    // Count by refusal type
    db
      .select({
        refusalType: judgment.refusalType,
        count: sql<number>`count(*)`,
      })
      .from(judgment)
      .where(baseWhere)
      .groupBy(judgment.refusalType),

    // Count by judgment mode
    db
      .select({
        judgmentMode: judgment.judgmentMode,
        count: sql<number>`count(*)`,
        completedCount: sql<number>`count(*) filter (where ${judgment.status} in ('completed', 'refused'))`,
      })
      .from(judgment)
      .where(allWhere)
      .groupBy(judgment.judgmentMode),

    // Count by values system
    db
      .select({
        valuesSystemId: judgment.valuesSystemId,
        name: valuesSystem.name,
        count: sql<number>`count(*)`,
      })
      .from(judgment)
      .leftJoin(valuesSystem, eq(judgment.valuesSystemId, valuesSystem.id))
      .where(baseWhere)
      .groupBy(judgment.valuesSystemId, valuesSystem.name),

    // Confidence stats per model
    db
      .select({
        modelConfigId: judgment.modelConfigId,
        displayName: modelConfig.displayName,
        avgConfidence: sql<number>`avg(${judgment.confidence})`,
        minConfidence: sql<number>`min(${judgment.confidence})`,
        maxConfidence: sql<number>`max(${judgment.confidence})`,
      })
      .from(judgment)
      .leftJoin(modelConfig, eq(judgment.modelConfigId, modelConfig.id))
      .where(
        and(
          ...baseConditions,
          sql`${judgment.confidence} IS NOT NULL`
        )
      )
      .groupBy(judgment.modelConfigId, modelConfig.displayName),

    // Choice × model cross-tab
    db
      .select({
        modelConfigId: judgment.modelConfigId,
        displayName: modelConfig.displayName,
        choice: judgment.choice,
        count: sql<number>`count(*)`,
      })
      .from(judgment)
      .leftJoin(modelConfig, eq(judgment.modelConfigId, modelConfig.id))
      .where(baseWhere)
      .groupBy(judgment.modelConfigId, modelConfig.displayName, judgment.choice),

    // Choice × values system cross-tab
    db
      .select({
        valuesSystemId: judgment.valuesSystemId,
        valuesName: valuesSystem.name,
        choice: judgment.choice,
        count: sql<number>`count(*)`,
      })
      .from(judgment)
      .leftJoin(valuesSystem, eq(judgment.valuesSystemId, valuesSystem.id))
      .where(baseWhere)
      .groupBy(judgment.valuesSystemId, valuesSystem.name, judgment.choice),
  ]);

  return ok({
    overview: {
      total: exp.totalJudgments,
      completed: exp.completedCount,
      failed: exp.failedCount,
    },
    dilemmas,
    byStatus,
    byModel,
    byChoice,
    byRefusalType,
    byMode,
    byValuesSystem,
    confidenceStats,
    choiceByModel,
    choiceByValues,
  });
}

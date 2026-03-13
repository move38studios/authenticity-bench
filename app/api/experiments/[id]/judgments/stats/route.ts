import { db } from "@/lib/db";
import { judgment, experiment } from "@/lib/db/schema/experiment";
import { modelConfig, dilemma, valuesSystem } from "@/lib/db/schema/content";
import { eq, sql, and, inArray } from "drizzle-orm";
import { getSession, unauthorized, notFound, ok } from "@/lib/api/helpers";

/**
 * GET /api/experiments/[id]/judgments/stats
 *
 * Aggregate statistics for charts and summary views.
 */
export async function GET(
  _request: Request,
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

  // Run all aggregation queries in parallel
  const [
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
    // Count by status
    db
      .select({
        status: judgment.status,
        count: sql<number>`count(*)`,
      })
      .from(judgment)
      .where(eq(judgment.experimentId, id))
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
      .where(eq(judgment.experimentId, id))
      .groupBy(judgment.modelConfigId, modelConfig.displayName, modelConfig.provider),

    // Count by choice (completed/refused only)
    db
      .select({
        choice: judgment.choice,
        count: sql<number>`count(*)`,
      })
      .from(judgment)
      .where(
        and(
          eq(judgment.experimentId, id),
          inArray(judgment.status, ["completed", "refused"])
        )
      )
      .groupBy(judgment.choice),

    // Count by refusal type
    db
      .select({
        refusalType: judgment.refusalType,
        count: sql<number>`count(*)`,
      })
      .from(judgment)
      .where(
        and(
          eq(judgment.experimentId, id),
          inArray(judgment.status, ["completed", "refused"])
        )
      )
      .groupBy(judgment.refusalType),

    // Count by judgment mode
    db
      .select({
        judgmentMode: judgment.judgmentMode,
        count: sql<number>`count(*)`,
        completedCount: sql<number>`count(*) filter (where ${judgment.status} in ('completed', 'refused'))`,
      })
      .from(judgment)
      .where(eq(judgment.experimentId, id))
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
      .where(
        and(
          eq(judgment.experimentId, id),
          inArray(judgment.status, ["completed", "refused"])
        )
      )
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
          eq(judgment.experimentId, id),
          inArray(judgment.status, ["completed", "refused"]),
          sql`${judgment.confidence} IS NOT NULL`
        )
      )
      .groupBy(judgment.modelConfigId, modelConfig.displayName),

    // Choice × model cross-tab (the core chart data)
    db
      .select({
        modelConfigId: judgment.modelConfigId,
        displayName: modelConfig.displayName,
        choice: judgment.choice,
        count: sql<number>`count(*)`,
      })
      .from(judgment)
      .leftJoin(modelConfig, eq(judgment.modelConfigId, modelConfig.id))
      .where(
        and(
          eq(judgment.experimentId, id),
          inArray(judgment.status, ["completed", "refused"])
        )
      )
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
      .where(
        and(
          eq(judgment.experimentId, id),
          inArray(judgment.status, ["completed", "refused"])
        )
      )
      .groupBy(judgment.valuesSystemId, valuesSystem.name, judgment.choice),
  ]);

  return ok({
    overview: {
      total: exp.totalJudgments,
      completed: exp.completedCount,
      failed: exp.failedCount,
    },
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

import { db } from "@/lib/db";
import { judgment } from "@/lib/db/schema/experiment";
import { modelConfig, dilemma, valuesSystem } from "@/lib/db/schema/content";
import { eq, and, inArray, sql, asc, desc } from "drizzle-orm";
import { getSession, unauthorized, notFound, ok } from "@/lib/api/helpers";
import { experiment } from "@/lib/db/schema/experiment";

const VALID_SORT_FIELDS = [
  "createdAt",
  "status",
  "judgmentMode",
  "choice",
  "confidence",
  "latencyMs",
  "costEstimate",
  "noiseIndex",
] as const;

/**
 * GET /api/experiments/[id]/judgments
 *
 * Paginated, filterable list of judgment rows.
 * Excludes large fields (conversationLog, rawResponse, systemPrompt, userPrompt).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  // Verify experiment exists
  const exp = await db.query.experiment.findFirst({
    where: eq(experiment.id, id),
    columns: { id: true },
  });
  if (!exp) return notFound("Experiment");

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [eq(judgment.experimentId, id)];

  const statusFilter = url.searchParams.get("status");
  if (statusFilter) {
    const statuses = statusFilter.split(",").map((s) => s.trim());
    conditions.push(inArray(judgment.status, statuses));
  }

  const modelFilter = url.searchParams.get("modelConfigId");
  if (modelFilter) conditions.push(eq(judgment.modelConfigId, modelFilter));

  const dilemmaFilter = url.searchParams.get("dilemmaId");
  if (dilemmaFilter) conditions.push(eq(judgment.dilemmaId, dilemmaFilter));

  const valuesFilter = url.searchParams.get("valuesSystemId");
  if (valuesFilter) {
    if (valuesFilter === "null") {
      conditions.push(sql`${judgment.valuesSystemId} IS NULL`);
    } else {
      conditions.push(eq(judgment.valuesSystemId, valuesFilter));
    }
  }

  const modeFilter = url.searchParams.get("judgmentMode");
  if (modeFilter) conditions.push(eq(judgment.judgmentMode, modeFilter));

  const choiceFilter = url.searchParams.get("choice");
  if (choiceFilter) conditions.push(eq(judgment.choice, choiceFilter));

  const refusalFilter = url.searchParams.get("refusalType");
  if (refusalFilter) {
    const types = refusalFilter.split(",").map((s) => s.trim());
    conditions.push(inArray(judgment.refusalType, types));
  }

  const where = and(...conditions);

  // Sort
  const sortField = url.searchParams.get("sort") ?? "createdAt";
  const sortOrder = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const validSort = VALID_SORT_FIELDS.includes(sortField as typeof VALID_SORT_FIELDS[number])
    ? sortField
    : "createdAt";
  const orderFn = sortOrder === "asc" ? asc : desc;
  const sortColumn = judgment[validSort as keyof typeof judgment] as typeof judgment.createdAt;

  // Count + fetch in parallel
  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(judgment)
      .where(where),
    db
      .select({
        id: judgment.id,
        status: judgment.status,
        dilemmaId: judgment.dilemmaId,
        modelConfigId: judgment.modelConfigId,
        valuesSystemId: judgment.valuesSystemId,
        mentalTechniqueIds: judgment.mentalTechniqueIds,
        modifierIds: judgment.modifierIds,
        judgmentMode: judgment.judgmentMode,
        noiseIndex: judgment.noiseIndex,
        refusalType: judgment.refusalType,
        choice: judgment.choice,
        reasoning: judgment.reasoning,
        confidence: judgment.confidence,
        errorMessage: judgment.errorMessage,
        latencyMs: judgment.latencyMs,
        promptTokens: judgment.promptTokens,
        completionTokens: judgment.completionTokens,
        costEstimate: judgment.costEstimate,
        createdAt: judgment.createdAt,
      })
      .from(judgment)
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return ok({
    judgments: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

import { db } from "@/lib/db";
import { judgment, experiment } from "@/lib/db/schema/experiment";
import { eq, and, inArray } from "drizzle-orm";
import { getSession, unauthorized, notFound, badRequest } from "@/lib/api/helpers";
import { exportExperimentToSQLite } from "@/lib/services/experiment/data-export";

const LIGHT_FIELDS = [
  "id", "status", "dilemmaId", "modelConfigId", "valuesSystemId",
  "mentalTechniqueIds", "modifierIds", "judgmentMode", "noiseIndex",
  "refusalType", "choice", "reasoning", "confidence", "errorMessage",
  "userPrompt", "systemPrompt",
  "latencyMs", "promptTokens", "completionTokens", "costEstimate", "createdAt",
] as const;

const HEAVY_FIELDS = [
  "conversationLog", "rawResponse",
  "inquiryToolCalls", "reasoningTokens",
] as const;

type FieldName = typeof LIGHT_FIELDS[number] | typeof HEAVY_FIELDS[number];

const ALL_FIELDS = new Set<string>([...LIGHT_FIELDS, ...HEAVY_FIELDS]);

/**
 * GET /api/experiments/[id]/export
 *
 * Download judgments as CSV, JSON, or JSONL.
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
    columns: { id: true, name: true },
  });
  if (!exp) return notFound("Experiment");

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  if (!["csv", "json", "jsonl", "sqlite"].includes(format)) {
    return badRequest("format must be csv, json, jsonl, or sqlite");
  }

  // SQLite export — returns full denormalized database file
  if (format === "sqlite") {
    const buffer = await exportExperimentToSQLite(id);
    const safeName = exp.name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="${safeName}_experiment.db"`,
      },
    });
  }

  // Parse field selection
  const fieldsParam = url.searchParams.get("fields");
  const includeFullResponses = url.searchParams.get("full") === "true";
  let selectedFields: FieldName[];

  if (fieldsParam) {
    selectedFields = fieldsParam.split(",").filter((f) => ALL_FIELDS.has(f)) as FieldName[];
    if (selectedFields.length === 0) selectedFields = [...LIGHT_FIELDS];
  } else {
    selectedFields = includeFullResponses
      ? [...LIGHT_FIELDS, ...HEAVY_FIELDS]
      : [...LIGHT_FIELDS];
  }

  // Build filter conditions
  const conditions = [eq(judgment.experimentId, id)];

  const statusFilter = url.searchParams.get("status") ?? "completed,refused";
  if (statusFilter !== "all") {
    conditions.push(inArray(judgment.status, statusFilter.split(",")));
  }

  const modelFilter = url.searchParams.get("modelConfigId");
  if (modelFilter) conditions.push(eq(judgment.modelConfigId, modelFilter));

  const modeFilter = url.searchParams.get("judgmentMode");
  if (modeFilter) conditions.push(eq(judgment.judgmentMode, modeFilter));

  // Fetch all matching rows
  const rows = await db
    .select()
    .from(judgment)
    .where(and(...conditions))
    .orderBy(judgment.createdAt);

  // Project to selected fields
  const projected = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const field of selectedFields) {
      obj[field] = row[field as keyof typeof row];
    }
    return obj;
  });

  const safeName = exp.name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50);
  const filename = `${safeName}_judgments.${format}`;

  if (format === "json") {
    return new Response(JSON.stringify(projected, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "jsonl") {
    const lines = projected.map((row) => JSON.stringify(row)).join("\n");
    return new Response(lines, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // CSV
  const csvHeader = selectedFields.join(",");
  const csvRows = projected.map((row) =>
    selectedFields
      .map((field) => {
        const val = row[field];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(",")
  );

  return new Response([csvHeader, ...csvRows].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

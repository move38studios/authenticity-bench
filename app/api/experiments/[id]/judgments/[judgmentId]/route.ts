import { db } from "@/lib/db";
import { judgment } from "@/lib/db/schema/experiment";
import { eq, and } from "drizzle-orm";
import { getSession, unauthorized, notFound, ok } from "@/lib/api/helpers";

/**
 * GET /api/experiments/[id]/judgments/[judgmentId]
 *
 * Full judgment detail including conversationLog, rawResponse, prompts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; judgmentId: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id, judgmentId } = await params;

  const rows = await db
    .select()
    .from(judgment)
    .where(and(eq(judgment.id, judgmentId), eq(judgment.experimentId, id)))
    .limit(1);

  if (rows.length === 0) return notFound("Judgment");

  return ok(rows[0]);
}

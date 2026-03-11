import { db } from "@/lib/db";
import { experiment } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getSession, unauthorized, notFound, ok } from "@/lib/api/helpers";

/**
 * POST /api/experiments/[id]/preview-token
 *
 * Generates (or regenerates) a preview token for the experiment.
 */
export async function POST(
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

  const previewToken = randomUUID();

  await db
    .update(experiment)
    .set({ previewToken, updatedAt: new Date() })
    .where(eq(experiment.id, id));

  return ok({ previewToken });
}

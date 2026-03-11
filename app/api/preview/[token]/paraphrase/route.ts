import { db } from "@/lib/db";
import { experiment, experimentDilemma, dilemma } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, ok, badRequest, parseBody } from "@/lib/api/helpers";
import { paraphraseScenario } from "@/lib/services/experiment";
import { z } from "zod/v4";

const paraphraseRequestSchema = z.object({
  dilemmaId: z.string().min(1),
  noiseIndex: z.number().int().min(1).max(10),
});

/**
 * POST /api/preview/[token]/paraphrase
 *
 * Public (no auth). Generates a paraphrased version of a dilemma scenario.
 * Only works for dilemmas that belong to this experiment.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rows = await db
    .select()
    .from(experiment)
    .where(eq(experiment.previewToken, token))
    .limit(1);

  if (rows.length === 0) return notFound("Preview");

  const parsed = await parseBody(request, paraphraseRequestSchema);
  if (!parsed.success) return parsed.response;

  const { dilemmaId, noiseIndex } = parsed.data;

  // Verify dilemma belongs to this experiment
  const junction = await db
    .select()
    .from(experimentDilemma)
    .where(
      and(
        eq(experimentDilemma.experimentId, rows[0].id),
        eq(experimentDilemma.dilemmaId, dilemmaId)
      )
    )
    .limit(1);

  if (junction.length === 0) return badRequest("Dilemma not part of this experiment");

  const [dilemmaRow] = await db
    .select()
    .from(dilemma)
    .where(eq(dilemma.id, dilemmaId))
    .limit(1);

  if (!dilemmaRow) return notFound("Dilemma");

  const paraphrased = await paraphraseScenario(
    dilemmaRow.scenario,
    noiseIndex,
    dilemmaId
  );

  return ok({ scenario: paraphrased, noiseIndex });
}

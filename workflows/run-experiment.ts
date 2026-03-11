/**
 * Run Experiment Workflow
 *
 * Vercel WDK durable workflow that orchestrates the full experiment lifecycle:
 * 1. Plan — generate judgment rows from cartesian product, paraphrase scenarios
 * 2. Execute — process judgments per provider in parallel with concurrency control
 * 3. Finalize — update experiment status, compute final counts
 * 4. Trigger analysis — placeholder for future analysis agent
 */

export async function runExperimentWorkflow(input: { experimentId: string }) {
  "use workflow";

  const { experimentId } = input;

  // Step 1: Plan
  const plan = await planStep(experimentId);

  // Step 2: Execute per provider in parallel
  const providers = Object.keys(plan.judgmentsByProvider);

  const results = await Promise.all(
    providers.map((provider) =>
      executeProviderStep(
        experimentId,
        provider,
        plan.judgmentsByProvider[provider]
      )
    )
  );

  // Step 3: Finalize
  await finalizeStep(experimentId, results);

  // Step 4: Trigger analysis (placeholder)
  await triggerAnalysisStep(experimentId);

  return {
    experimentId,
    totalJudgments: plan.totalJudgments,
    providers,
  };
}

// =============================================================================
// STEPS
// =============================================================================

async function planStep(experimentId: string) {
  "use step";
  const { planExperiment } = await import(
    "@/lib/services/experiment/planner"
  );
  return planExperiment(experimentId);
}

async function executeProviderStep(
  experimentId: string,
  provider: string,
  judgmentIds: string[]
) {
  "use step";
  const { executeProviderBatch } = await import(
    "@/lib/services/experiment/executor"
  );
  return executeProviderBatch(experimentId, judgmentIds);
}

async function finalizeStep(
  experimentId: string,
  results: Array<{ completed: number; refused: number; errors: number }>
) {
  "use step";
  const { db } = await import("@/lib/db");
  const { experiment } = await import("@/lib/db/schema/experiment");
  const { eq } = await import("drizzle-orm");

  const totals = results.reduce(
    (acc, r) => ({
      completed: acc.completed + r.completed,
      refused: acc.refused + r.refused,
      errors: acc.errors + r.errors,
    }),
    { completed: 0, refused: 0, errors: 0 }
  );

  // Check if cancelled/failed during execution
  const exp = await db.query.experiment.findFirst({
    where: eq(experiment.id, experimentId),
    columns: { status: true },
  });

  const finalStatus =
    exp?.status === "cancelled"
      ? "cancelled"
      : totals.errors > 0
        ? "completed" // partial completion is still "completed"
        : "completed";

  await db
    .update(experiment)
    .set({
      status: finalStatus,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(experiment.id, experimentId));

  return totals;
}

async function triggerAnalysisStep(experimentId: string) {
  "use step";
  const { db } = await import("@/lib/db");
  const { experiment } = await import("@/lib/db/schema/experiment");
  const { eq } = await import("drizzle-orm");

  await db
    .update(experiment)
    .set({
      analysisStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(experiment.id, experimentId));
}

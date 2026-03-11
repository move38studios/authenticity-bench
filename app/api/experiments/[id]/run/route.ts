import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { experiment } from "@/lib/db/schema/experiment";
import { eq } from "drizzle-orm";
import { start, getRun } from "workflow/api";
import { runExperimentWorkflow } from "@/workflows/run-experiment";

/**
 * POST /api/experiments/[id]/run — Start experiment execution
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify experiment exists and is in a runnable state
  const exp = await db.query.experiment.findFirst({
    where: eq(experiment.id, id),
  });

  if (!exp) {
    return NextResponse.json(
      { error: "Experiment not found" },
      { status: 404 }
    );
  }

  if (exp.status !== "draft" && exp.status !== "failed") {
    return NextResponse.json(
      {
        error: `Cannot run experiment with status "${exp.status}". Must be "draft" or "failed".`,
      },
      { status: 400 }
    );
  }

  try {
    const run = await start(runExperimentWorkflow, [{ experimentId: id }]);

    return NextResponse.json({
      data: {
        runId: run.runId,
        experimentId: id,
        status: "started",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/experiments/[id]/run — Pause, resume, or cancel
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body as { action: "pause" | "resume" | "cancel" };

  if (!["pause", "resume", "cancel"].includes(action)) {
    return NextResponse.json(
      { error: 'action must be "pause", "resume", or "cancel"' },
      { status: 400 }
    );
  }

  const exp = await db.query.experiment.findFirst({
    where: eq(experiment.id, id),
    columns: { status: true },
  });

  if (!exp) {
    return NextResponse.json(
      { error: "Experiment not found" },
      { status: 404 }
    );
  }

  let newStatus: string;
  switch (action) {
    case "pause":
      if (exp.status !== "running") {
        return NextResponse.json(
          { error: "Can only pause a running experiment" },
          { status: 400 }
        );
      }
      newStatus = "paused";
      break;
    case "resume":
      if (exp.status !== "paused") {
        return NextResponse.json(
          { error: "Can only resume a paused experiment" },
          { status: 400 }
        );
      }
      newStatus = "running";
      break;
    case "cancel":
      if (exp.status !== "running" && exp.status !== "paused") {
        return NextResponse.json(
          { error: "Can only cancel a running or paused experiment" },
          { status: 400 }
        );
      }
      newStatus = "cancelled";
      break;
  }

  await db
    .update(experiment)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(experiment.id, id));

  return NextResponse.json({
    data: { experimentId: id, status: newStatus },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/api/helpers";
import { start, getRun } from "workflow/api";
import { testWorkflow } from "@/workflows/test-workflow";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { modelId, prompt } = body as { modelId: string; prompt: string };

  if (!modelId || !prompt) {
    return NextResponse.json(
      { error: "modelId and prompt are required" },
      { status: 400 }
    );
  }

  try {
    const run = await start(testWorkflow, [{ modelId, prompt }]);
    return NextResponse.json({
      data: {
        runId: run.runId,
        status: "started",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = request.nextUrl.searchParams.get("id");
  if (!runId) {
    return NextResponse.json(
      { error: "id query param required" },
      { status: 400 }
    );
  }

  try {
    const run = getRun(runId);
    const status = await run.status;
    return NextResponse.json({ data: { runId, status } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

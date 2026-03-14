import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorized, notFound, ok } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { experiment } from "@/lib/db/schema/experiment";
import { eq } from "drizzle-orm";
import { getModel } from "@/lib/services/llm";
import { getPrompt } from "@/lib/services/prompts";
import { exportExperimentToSQLite } from "@/lib/services/experiment/data-export";
import { generateText, stepCountIs } from "ai";
import { z } from "zod/v4";
import { Sandbox, Snapshot } from "@vercel/sandbox";

const ANALYSIS_MODEL = "anthropic/claude-sonnet-4-6";

const PREINSTALLED_PACKAGES = [
  "numpy", "pandas", "matplotlib", "scipy",
  "scikit-learn", "seaborn", "duckdb",
];

let cachedSnapshotId: string | null = null;

async function getOrCreateSnapshot(): Promise<string> {
  if (cachedSnapshotId) {
    try {
      const snap = await Snapshot.get({ snapshotId: cachedSnapshotId });
      if (snap.status === "created") return cachedSnapshotId;
    } catch {
      cachedSnapshotId = null;
    }
  }
  const sandbox = await Sandbox.create({ runtime: "python3.13", timeout: 300_000 });
  await sandbox.runCommand("pip", ["install", "-q", ...PREINSTALLED_PACKAGES]);
  const snapshot = await sandbox.snapshot();
  cachedSnapshotId = snapshot.snapshotId;
  return cachedSnapshotId;
}

const SCHEMA_DESCRIPTION = `
## SQLite Database Schema (/data/experiment.db)

### judgment (main table)
id, experiment_id, dilemma_id, model_config_id, values_system_id,
mental_technique_ids (JSON), modifier_ids (JSON),
judgment_mode, noise_index, status, refusal_type, choice, reasoning,
confidence, latency_ms, prompt_tokens, completion_tokens, cost_estimate, created_at,
model_name, model_provider, dilemma_title, values_system_name,
technique_names, modifier_names

### dilemma: id, title, scenario, domain, tags (JSON), options (JSON)
### model: id, provider, model_id, display_name
### values_system: id, name, content, description
### mental_technique: id, name, content, description
### modifier: id, name, content, description
### experiment: id, name, description, status, judgment_modes, noise_repeats, total_judgments, completed_count, failed_count
`.trim();

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  const exp = await db.query.experiment.findFirst({
    where: eq(experiment.id, id),
  });
  if (!exp) return notFound("Experiment");

  // Mark as running
  await db.update(experiment)
    .set({ analysisStatus: "running", updatedAt: new Date() })
    .where(eq(experiment.id, id));

  let sandbox: Sandbox | null = null;

  try {
    const [sqliteBuffer, snapshotId, model, analysisSystemPrompt, reportPrompt] =
      await Promise.all([
        exportExperimentToSQLite(id),
        getOrCreateSnapshot(),
        getModel(ANALYSIS_MODEL),
        getPrompt("analysis_system"),
        getPrompt("analysis_auto_report"),
      ]);

    sandbox = await Sandbox.create({
      source: { type: "snapshot", snapshotId },
      runtime: "python3.13",
      timeout: 120_000,
    });

    await sandbox.writeFiles([
      { path: "data/experiment.db", content: sqliteBuffer },
    ]);

    const systemPrompt = `${analysisSystemPrompt}

## Experiment: ${exp.name}
${exp.description ?? ""}

${SCHEMA_DESCRIPTION}

IMPORTANT: You are generating an automated report. Output your final analysis as clean markdown. Do not include image outputs — focus on tables, numbers, and text insights.`;

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: reportPrompt,
      tools: {
        execute_python: {
          description: "Execute Python code to query the SQLite database and analyze data.",
          inputSchema: z.object({
            code: z.string().describe("Python code to execute"),
          }),
          execute: async ({ code }) => {
            await sandbox!.writeFiles([
              { path: "script.py", content: Buffer.from(code) },
            ]);
            const r = await sandbox!.runCommand("python3", ["script.py"]);
            const stdout = await r.stdout();
            const stderr = await r.stderr();
            return {
              stdout: stdout.slice(0, 50000),
              stderr: stderr.slice(0, 10000),
              exitCode: r.exitCode,
            };
          },
        },
      },
      stopWhen: stepCountIs(15),
    });

    // Save the report
    await db.update(experiment)
      .set({
        analysisReport: result.text,
        analysisStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(experiment.id, id));

    return ok({ report: result.text });
  } catch (e) {
    await db.update(experiment)
      .set({
        analysisStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(experiment.id, id));

    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  } finally {
    if (sandbox) await sandbox.stop().catch(() => {});
  }
}

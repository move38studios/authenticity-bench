import { NextRequest } from "next/server";
import { getSession, unauthorized, notFound } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { experiment } from "@/lib/db/schema/experiment";
import { eq } from "drizzle-orm";
import { getModel } from "@/lib/services/llm";
import { getPrompt } from "@/lib/services/prompts";
import { exportExperimentToSQLite } from "@/lib/services/experiment/data-export";
import { streamText, stepCountIs } from "ai";
import { z } from "zod/v4";
import { Sandbox, Snapshot } from "@vercel/sandbox";

const ANALYSIS_MODEL = "anthropic/claude-sonnet-4-6";

const PREINSTALLED_PACKAGES = [
  "numpy",
  "pandas",
  "matplotlib",
  "scipy",
  "scikit-learn",
  "seaborn",
  "duckdb",
];

let cachedAnalysisSnapshotId: string | null = null;

async function getOrCreateAnalysisSnapshot(): Promise<string> {
  if (cachedAnalysisSnapshotId) {
    try {
      const snap = await Snapshot.get({ snapshotId: cachedAnalysisSnapshotId });
      if (snap.status === "created") return cachedAnalysisSnapshotId;
    } catch {
      cachedAnalysisSnapshotId = null;
    }
  }

  const sandbox = await Sandbox.create({
    runtime: "python3.13",
    timeout: 300_000,
  });

  await sandbox.runCommand("pip", ["install", "-q", ...PREINSTALLED_PACKAGES]);

  const snapshot = await sandbox.snapshot();
  cachedAnalysisSnapshotId = snapshot.snapshotId;
  return cachedAnalysisSnapshotId;
}

const SCHEMA_DESCRIPTION = `
## SQLite Database Schema (/data/experiment.db)

### experiment (single row)
id, name, description, status, judgment_modes (JSON array), noise_repeats,
total_judgments, completed_count, failed_count, started_at, finished_at, created_at

### judgment
id, experiment_id, dilemma_id, model_config_id, values_system_id,
mental_technique_ids (JSON array), modifier_ids (JSON array),
judgment_mode ("theory"|"single-shot-action"|"inquiry-to-action"),
noise_index, status, refusal_type ("none"|"hard"|"soft"|"conditional"),
choice (option slug), reasoning, confidence (0.0-1.0),
system_prompt, user_prompt, conversation_log (JSON), raw_response (JSON),
inquiry_tool_calls (JSON), error_message,
latency_ms, prompt_tokens, completion_tokens, reasoning_tokens, cost_estimate,
created_at,
-- denormalized:
model_name, model_provider, dilemma_title, values_system_name,
technique_names (comma-separated), modifier_names (comma-separated)

### dilemma
id, title, scenario, domain, tags (JSON array), options (JSON array)

### model
id, provider, model_id, display_name

### values_system
id, name, content, description

### mental_technique
id, name, content, description

### modifier
id, name, content, description
`.trim();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  const exp = await db.query.experiment.findFirst({
    where: eq(experiment.id, id),
    columns: { id: true, name: true, description: true, status: true, noiseRepeats: true, totalJudgments: true, completedCount: true },
  });
  if (!exp) return notFound("Experiment");

  const { messages } = await request.json();

  // Build system prompt
  const baseSystemPrompt = await getPrompt("analysis_system");
  const systemPrompt = `${baseSystemPrompt}

## Experiment Context
- **Name**: ${exp.name}
- **Description**: ${exp.description ?? "N/A"}
- **Status**: ${exp.status}
- **Noise Repeats**: ${exp.noiseRepeats}
- **Total Judgments**: ${exp.totalJudgments ?? "N/A"}
- **Completed**: ${exp.completedCount ?? 0}

${SCHEMA_DESCRIPTION}`;

  // Export data and set up sandbox
  const [sqliteBuffer, snapshotId, model] = await Promise.all([
    exportExperimentToSQLite(id),
    getOrCreateAnalysisSnapshot(),
    getModel(ANALYSIS_MODEL),
  ]);

  const sandbox = await Sandbox.create({
    source: { type: "snapshot", snapshotId },
    runtime: "python3.13",
    timeout: 120_000,
  });

  // Upload SQLite file
  await sandbox.writeFiles([
    { path: "data/experiment.db", content: sqliteBuffer },
  ]);

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    tools: {
      execute_python: {
        description: "Execute Python code in the sandbox. Use this to query the SQLite database, analyze data, or create visualizations. Print results to stdout.",
        inputSchema: z.object({
          code: z.string().describe("Python code to execute"),
        }),
        execute: async ({ code }) => {
          await sandbox.writeFiles([
            { path: "script.py", content: Buffer.from(code) },
          ]);
          const result = await sandbox.runCommand("python3", ["script.py"]);
          const stdout = await result.stdout();
          const stderr = await result.stderr();
          return {
            stdout: stdout.slice(0, 50000),
            stderr: stderr.slice(0, 10000),
            exitCode: result.exitCode,
          };
        },
      },
    },
    stopWhen: stepCountIs(10),
    onFinish: async () => {
      await sandbox.stop().catch(() => {});
    },
    onError: async () => {
      await sandbox.stop().catch(() => {});
    },
  });

  return result.toUIMessageStreamResponse();
}

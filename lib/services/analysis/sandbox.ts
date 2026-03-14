/**
 * Sandbox Management for Analysis Agent
 *
 * Manages Vercel Sandbox snapshots with pre-installed Python packages.
 */

import { Sandbox, Snapshot } from "@vercel/sandbox";

const PREINSTALLED_PACKAGES = [
  "numpy", "pandas", "matplotlib", "scipy",
  "scikit-learn", "seaborn", "duckdb",
];

let cachedSnapshotId: string | null = null;

export async function getOrCreateAnalysisSnapshot(): Promise<string> {
  if (cachedSnapshotId) {
    try {
      const snap = await Snapshot.get({ snapshotId: cachedSnapshotId });
      if (snap.status === "created") return cachedSnapshotId;
    } catch {
      cachedSnapshotId = null;
    }
  }

  const sandbox = await Sandbox.create({
    runtime: "python3.13",
    timeout: 300_000,
  });

  await sandbox.runCommand("pip", ["install", "-q", ...PREINSTALLED_PACKAGES]);

  const snapshot = await sandbox.snapshot();
  cachedSnapshotId = snapshot.snapshotId;
  return cachedSnapshotId;
}

export async function createAnalysisSandbox(): Promise<Sandbox> {
  const snapshotId = await getOrCreateAnalysisSnapshot();
  return Sandbox.create({
    source: { type: "snapshot", snapshotId },
    runtime: "python3.13",
    timeout: 120_000,
  });
}

export const SCHEMA_DESCRIPTION = `
## Database Schema

Each loaded experiment creates a SQLite file at data/{sanitized_name}.db (relative path).
Use duckdb to query it (sqlite3 is NOT available in this environment):
  import duckdb
  con = duckdb.connect('data/{name}.db')

Tables:

### experiment (single row)
id, name, description, status, judgment_modes (JSON array), noise_repeats,
total_judgments, completed_count, failed_count, started_at, finished_at, created_at

### judgment (main data table)
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

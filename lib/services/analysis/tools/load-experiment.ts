/**
 * load_experiment tool — Export experiment data to SQLite and load into sandbox
 */

import { tool } from "ai";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { experiment } from "@/lib/db/schema/experiment";
import { analysisChat } from "@/lib/db/schema/analysis-chat";
import { eq } from "drizzle-orm";
import { exportExperimentToSQLite } from "@/lib/services/experiment/data-export";
import { uploadAnalysisFile } from "@/lib/services/blob";
import type { Sandbox } from "@vercel/sandbox";

interface LoadedExperiment {
  experimentId: string;
  blobUrl: string;
  name: string;
  loadedAt: string;
}

export function createLoadExperimentTool(getSandbox: () => Promise<Sandbox>, chatId: string) {
  return tool({
    description:
      "Load an experiment's data into the sandbox for analysis. Exports all judgments, dilemmas, models, etc. to a SQLite database file. Can be called multiple times to load multiple experiments.",
    inputSchema: z.object({
      experimentId: z.string().describe("The experiment ID to load"),
    }),
    execute: async ({ experimentId }) => {
      // Verify experiment exists
      const exp = await db.query.experiment.findFirst({
        where: eq(experiment.id, experimentId),
        columns: { id: true, name: true, status: true, completedCount: true, totalJudgments: true },
      });
      if (!exp) {
        return { success: false, error: `Experiment not found: ${experimentId}` };
      }

      // Export to SQLite
      const sqliteBuffer = await exportExperimentToSQLite(experimentId);

      // Upload to Blob
      const blobPath = `analysis/data/${experimentId}/${Date.now()}.db`;
      const blobUrl = await uploadAnalysisFile(sqliteBuffer, blobPath, "application/x-sqlite3");

      // Write to sandbox
      const sandbox = await getSandbox();
      const safeName = exp.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50).toLowerCase();
      const sandboxPath = `data/${safeName}.db`;
      await sandbox.writeFiles([
        { path: sandboxPath, content: sqliteBuffer },
      ]);

      // Record on chat's loadedExperiments
      const chat = await db.query.analysisChat.findFirst({
        where: eq(analysisChat.id, chatId),
        columns: { loadedExperiments: true },
      });

      const existing = (chat?.loadedExperiments as LoadedExperiment[]) ?? [];
      // Replace if same experiment already loaded, otherwise append
      const filtered = existing.filter((e) => e.experimentId !== experimentId);
      const updated = [
        ...filtered,
        { experimentId, blobUrl, name: exp.name, loadedAt: new Date().toISOString() },
      ];

      await db
        .update(analysisChat)
        .set({ loadedExperiments: updated, updatedAt: new Date() })
        .where(eq(analysisChat.id, chatId));

      return {
        success: true,
        experimentName: exp.name,
        sandboxPath,
        status: exp.status,
        completedJudgments: exp.completedCount,
        totalJudgments: exp.totalJudgments,
        message: `Loaded experiment "${exp.name}" to ${sandboxPath}. Query it with: import duckdb; con = duckdb.connect('${sandboxPath}')`,
      };
    },
  });
}

/**
 * list_experiments tool — Browse available experiments
 */

import { tool } from "ai";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { experiment } from "@/lib/db/schema/experiment";
import { eq } from "drizzle-orm";

export const listExperimentsTool = tool({
  description:
    "List available experiments. Returns id, name, status, judgment counts, and dates. Use this to find experiments to load.",
  inputSchema: z.object({
    status: z
      .string()
      .optional()
      .describe("Filter by status: draft, running, paused, completed, failed. Omit for all."),
  }),
  execute: async ({ status }) => {
    const conditions = status ? eq(experiment.status, status) : undefined;

    const experiments = await db.query.experiment.findMany({
      where: conditions,
      columns: {
        id: true,
        name: true,
        description: true,
        status: true,
        totalJudgments: true,
        completedCount: true,
        failedCount: true,
        noiseRepeats: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
      orderBy: (exp, { desc }) => [desc(exp.createdAt)],
    });

    return {
      count: experiments.length,
      experiments: experiments.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        status: e.status,
        totalJudgments: e.totalJudgments,
        completedCount: e.completedCount,
        failedCount: e.failedCount,
        noiseRepeats: e.noiseRepeats,
        startedAt: e.startedAt?.toISOString() ?? null,
        finishedAt: e.finishedAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  },
});

/**
 * execute_python tool — Run Python code in the sandbox with file output support
 */

import { tool } from "ai";
import { z } from "zod/v4";
import { uploadAnalysisFile } from "@/lib/services/blob";
import type { Sandbox } from "@vercel/sandbox";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".html": "text/html",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
};

function getContentType(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

export function createExecutePythonTool(
  getSandbox: () => Promise<Sandbox>,
  chatId: string,
  executionCounter: { count: number }
) {
  return tool({
    description:
      "Execute Python code in the sandbox. Use duckdb to query .db files (sqlite3 is NOT available). Pre-installed packages: numpy, pandas, matplotlib, seaborn, scipy, scikit-learn, duckdb. IMPORTANT: Save output files (charts, CSVs) to the current working directory (e.g. plt.savefig('chart.png')), NOT to /tmp. Declare them in outputFileNames so they get uploaded and returned as permanent URLs.",
    inputSchema: z.object({
      code: z.string().describe("Python code to execute"),
      outputFileNames: z
        .array(z.string())
        .optional()
        .describe("File names the code will produce (e.g. ['chart.png', 'results.csv']). These will be uploaded and returned as permanent URLs."),
    }),
    execute: async ({ code, outputFileNames }) => {
      executionCounter.count++;
      const executionId = `exec_${executionCounter.count}`;

      // Write and run the code
      const sandbox = await getSandbox();
      await sandbox.writeFiles([
        { path: "script.py", content: Buffer.from(code) },
      ]);

      const result = await sandbox.runCommand("python3", ["script.py"]);
      const stdout = await result.stdout();
      const stderr = await result.stderr();

      // Process output files
      const files: Array<{
        fileName: string;
        url: string;
        contentType: string;
        size: number;
      }> = [];

      if (outputFileNames?.length && result.exitCode === 0) {
        for (const fileName of outputFileNames) {
          try {
            // Try the declared path first (relative to /vercel/sandbox),
            // then fall back to /tmp/ since LLMs often save there
            const baseName = fileName.replace(/^\/tmp\//, "");
            const candidatePaths = [
              fileName,
              `/tmp/${baseName}`,
            ];

            let fileBuffer: Buffer | null = null;
            for (const candidate of candidatePaths) {
              const buf = await sandbox.readFileToBuffer({ path: candidate });
              if (buf) {
                fileBuffer = Buffer.from(buf);
                break;
              }
            }
            if (!fileBuffer) continue;

            const contentType = getContentType(baseName);
            const blobPath = `analysis/files/${chatId}/${executionId}/${baseName}`;
            const url = await uploadAnalysisFile(fileBuffer, blobPath, contentType);

            files.push({
              fileName: baseName,
              url,
              contentType,
              size: fileBuffer.length,
            });
          } catch {
            // File doesn't exist or couldn't be read — skip
          }
        }
      }

      return {
        success: result.exitCode === 0,
        stdout: stdout.slice(0, 50000),
        stderr: stderr.slice(0, 10000),
        exitCode: result.exitCode,
        files,
      };
    },
  });
}

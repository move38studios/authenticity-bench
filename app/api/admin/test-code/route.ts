import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/api/helpers";
import { Sandbox, Snapshot } from "@vercel/sandbox";

// Common data-science packages to pre-install
const PREINSTALLED_PACKAGES = [
  "numpy",
  "pandas",
  "matplotlib",
  "scipy",
  "scikit-learn",
  "seaborn",
  "duckdb",
];

// Cache the snapshot ID so subsequent calls skip package installation
let cachedSnapshotId: string | null = null;

async function getOrCreateSnapshot(): Promise<string> {
  if (cachedSnapshotId) {
    // Verify snapshot still exists
    try {
      const snap = await Snapshot.get({ snapshotId: cachedSnapshotId });
      if (snap.status === "created") return cachedSnapshotId;
    } catch {
      cachedSnapshotId = null;
    }
  }

  // Create a fresh sandbox, install packages, snapshot it
  const sandbox = await Sandbox.create({
    runtime: "python3.13",
    timeout: 300_000,
  });

  await sandbox.runCommand("pip", [
    "install",
    "-q",
    ...PREINSTALLED_PACKAGES,
  ]);

  const snapshot = await sandbox.snapshot();
  // sandbox.snapshot() stops the sandbox automatically
  cachedSnapshotId = snapshot.snapshotId;
  return cachedSnapshotId;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = (await request.json()) as { code?: string };
  if (!code?.trim()) {
    return NextResponse.json(
      { error: "code is required" },
      { status: 400 }
    );
  }

  const startTime = Date.now();
  let sandbox: Sandbox | null = null;

  try {
    const snapshotId = await getOrCreateSnapshot();

    sandbox = await Sandbox.create({
      source: { type: "snapshot", snapshotId },
      runtime: "python3.13",
      timeout: 120_000,
    });

    // Write code to a file (more robust than -c for multiline code)
    await sandbox.writeFiles([
      { path: "script.py", content: Buffer.from(code) },
    ]);

    const result = await sandbox.runCommand("python3", ["script.py"]);
    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      data: {
        stdout: await result.stdout(),
        stderr: await result.stderr(),
        exitCode: result.exitCode,
        latencyMs,
      },
    });
  } catch (e) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
        latencyMs,
      },
      { status: 500 }
    );
  } finally {
    if (sandbox) {
      await sandbox.stop().catch(() => {});
    }
  }
}

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Play, Pause, Square, RotateCcw, Pencil } from "lucide-react";
import Link from "next/link";
import { useExperiment } from "./layout";

// =============================================================================
// LABELS
// =============================================================================

const modeLabels: Record<string, string> = {
  theory: "Theory",
  "single-shot-action": "Single-shot Action",
  "inquiry-to-action": "Inquiry-to-Action",
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function ExperimentOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data, optimisticRef } = useExperiment();
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  if (!data) return null;

  const total = data.totalJudgments ?? 0;
  const done = data.completedCount + data.failedCount;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isActive = data.status === "running" || data.status === "paused";
  const canRun = data.status === "draft" || data.status === "failed";

  async function handleRun() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/experiments/${id}/run`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to start experiment");
      } else {
        optimisticRef.current = { status: "running", until: Date.now() + 10_000 };
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAction(action: "pause" | "resume" | "cancel") {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/experiments/${id}/run`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Failed to ${action}`);
      } else {
        const newStatus =
          action === "pause" ? "paused" : action === "resume" ? "running" : "cancelled";
        optimisticRef.current = { status: newStatus, until: Date.now() + 10_000 };
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Progress card */}
      {data.status !== "draft" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Execution Progress</CardTitle>
            {data.startedAt && (
              <CardDescription>
                Started {new Date(data.startedAt).toLocaleString()}
                {data.finishedAt &&
                  ` — Finished ${new Date(data.finishedAt).toLocaleString()}`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {done.toLocaleString()} / {total.toLocaleString()} judgments
                </span>
                <span className="font-mono font-medium">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Total" value={total.toLocaleString()} />
              <Stat label="Completed" value={data.completedCount.toLocaleString()} />
              <Stat label="Failed" value={data.failedCount.toLocaleString()} warn={data.failedCount > 0} />
              <Stat label="Remaining" value={(total - done).toLocaleString()} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.status === "draft" && (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/experiments/${id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />Edit Configuration
                </Link>
              </Button>
            )}
            {canRun && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={actionLoading}>
                    {data.status === "failed" ? (
                      <><RotateCcw className="h-4 w-4 mr-2" />Retry Experiment</>
                    ) : (
                      <><Play className="h-4 w-4 mr-2" />Run Experiment</>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {data.status === "failed" ? "Retry Experiment?" : "Run Experiment?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {data.status === "failed"
                        ? `This will re-run the experiment, processing any remaining pending judgments. ${total.toLocaleString()} total judgments configured.`
                        : `This will start the experiment, creating and processing ${total.toLocaleString()} judgments across all configured models and dilemmas. This may take a while and will use API credits.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRun}>
                      {data.status === "failed" ? "Retry" : "Start Experiment"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {data.status === "running" && (
              <Button variant="outline" onClick={() => handleAction("pause")} disabled={actionLoading}>
                <Pause className="h-4 w-4 mr-2" />Pause
              </Button>
            )}

            {data.status === "paused" && (
              <Button onClick={() => handleAction("resume")} disabled={actionLoading}>
                <Play className="h-4 w-4 mr-2" />Resume
              </Button>
            )}

            {isActive && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={actionLoading}>
                    <Square className="h-4 w-4 mr-2" />Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Experiment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop the experiment. Completed judgments will be preserved, but remaining pending judgments will not be processed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Running</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleAction("cancel")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Cancel Experiment
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Stat label="Models" value={data.modelConfigIds.length.toString()} />
            <Stat label="Dilemmas" value={data.dilemmaIds.length.toString()} />
            <Stat label="Values Systems" value={`${data.valuesSystemIds.length} + baseline`} />
            <Stat label="Modes" value={data.judgmentModes.map((m) => modeLabels[m] ?? m).join(", ")} />
            <Stat label="Techniques" value={data.mentalTechniqueIds.length.toString()} />
            <Stat label="Modifiers" value={data.modifierIds.length.toString()} />
            <Stat label="Noise Repeats" value={data.noiseRepeats.toString()} />
            <Stat label="Total Judgments" value={total.toLocaleString()} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// STAT COMPONENT
// =============================================================================

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono truncate ${warn ? "text-destructive" : ""}`} title={value}>
        {value}
      </div>
    </div>
  );
}

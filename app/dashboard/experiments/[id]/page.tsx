"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  RotateCcw,
  Loader2,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface ExperimentData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  judgmentModes: string[];
  noiseRepeats: number;
  totalJudgments: number | null;
  completedCount: number;
  failedCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  analysisStatus: string | null;
  modelConfigIds: string[];
  dilemmaIds: string[];
  valuesSystemIds: string[];
  mentalTechniqueIds: string[];
  modifierIds: string[];
  createdAt: string;
}

// =============================================================================
// STATUS DISPLAY
// =============================================================================

const statusConfig: Record<
  string,
  { color: string; label: string }
> = {
  draft: { color: "bg-muted text-muted-foreground", label: "Draft" },
  running: { color: "bg-blue-100 text-blue-800", label: "Running" },
  paused: { color: "bg-amber-100 text-amber-800", label: "Paused" },
  completed: { color: "bg-green-100 text-green-800", label: "Completed" },
  failed: { color: "bg-red-100 text-red-800", label: "Failed" },
  cancelled: { color: "bg-muted text-muted-foreground", label: "Cancelled" },
};

const modeLabels: Record<string, string> = {
  theory: "Theory",
  "single-shot-action": "Single-shot Action",
  "inquiry-to-action": "Inquiry-to-Action",
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ExperimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/experiments/${id}`);
    if (res.ok) {
      const json = await res.json();
      setData(json.data);
      return json.data as ExperimentData;
    }
    return null;
  }, [id]);

  // Initial load
  useEffect(() => {
    fetchData().then(() => setLoading(false));
  }, [fetchData]);

  // Poll while running or paused
  useEffect(() => {
    if (!data) return;
    const shouldPoll = data.status === "running" || data.status === "paused";

    if (shouldPoll) {
      pollRef.current = setInterval(async () => {
        const updated = await fetchData();
        if (
          updated &&
          updated.status !== "running" &&
          updated.status !== "paused"
        ) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 3000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [data?.status, fetchData]);

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  async function handleRun() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/experiments/${id}/run`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to start experiment");
      } else {
        await fetchData();
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
        await fetchData();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Experiment not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard/experiments">Back to Experiments</Link>
        </Button>
      </div>
    );
  }

  const total = data.totalJudgments ?? 0;
  const done = data.completedCount + data.failedCount;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const statusInfo = statusConfig[data.status] ?? statusConfig.draft;
  const isActive = data.status === "running" || data.status === "paused";
  const canRun = data.status === "draft" || data.status === "failed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link href="/dashboard/experiments">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {data.name}
            </h1>
          </div>
          {data.description && (
            <p className="text-muted-foreground text-sm ml-8">
              {data.description}
            </p>
          )}
        </div>
        <Badge variant="secondary" className={`${statusInfo.color} shrink-0`}>
          {isActive && (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          )}
          {statusInfo.label}
        </Badge>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Progress card — shown when running/paused/completed/failed/cancelled */}
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
              <Stat
                label="Completed"
                value={data.completedCount.toLocaleString()}
              />
              <Stat
                label="Failed"
                value={data.failedCount.toLocaleString()}
                warn={data.failedCount > 0}
              />
              <Stat
                label="Remaining"
                value={(total - done).toLocaleString()}
              />
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
            {canRun && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={actionLoading}>
                    {data.status === "failed" ? (
                      <>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Retry Experiment
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Experiment
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {data.status === "failed"
                        ? "Retry Experiment?"
                        : "Run Experiment?"}
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
                      {data.status === "failed"
                        ? "Retry"
                        : "Start Experiment"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {data.status === "running" && (
              <Button
                variant="outline"
                onClick={() => handleAction("pause")}
                disabled={actionLoading}
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}

            {data.status === "paused" && (
              <Button
                onClick={() => handleAction("resume")}
                disabled={actionLoading}
              >
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}

            {isActive && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={actionLoading}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Experiment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop the experiment. Completed judgments will be
                      preserved, but remaining pending judgments will not be
                      processed.
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
            <Stat
              label="Models"
              value={data.modelConfigIds.length.toString()}
            />
            <Stat
              label="Dilemmas"
              value={data.dilemmaIds.length.toString()}
            />
            <Stat
              label="Values Systems"
              value={`${data.valuesSystemIds.length} + baseline`}
            />
            <Stat
              label="Modes"
              value={data.judgmentModes
                .map((m) => modeLabels[m] ?? m)
                .join(", ")}
            />
            <Stat
              label="Techniques"
              value={data.mentalTechniqueIds.length.toString()}
            />
            <Stat
              label="Modifiers"
              value={data.modifierIds.length.toString()}
            />
            <Stat
              label="Noise Repeats"
              value={data.noiseRepeats.toString()}
            />
            <Stat
              label="Total Judgments"
              value={total.toLocaleString()}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// STAT COMPONENT
// =============================================================================

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-sm font-mono truncate ${warn ? "text-destructive" : ""}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

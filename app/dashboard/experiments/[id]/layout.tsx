"use client";

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface ExperimentData {
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
  analysisReport: string | null;
  modelConfigIds: string[];
  dilemmaIds: string[];
  valuesSystemIds: string[];
  mentalTechniqueIds: string[];
  modifierIds: string[];
  createdAt: string;
}

interface ExperimentContextValue {
  data: ExperimentData | null;
  loading: boolean;
  fetchData: () => Promise<ExperimentData | null>;
  optimisticRef: React.RefObject<{ status: string; until: number } | null>;
}

const ExperimentContext = createContext<ExperimentContextValue | null>(null);

export function useExperiment() {
  const ctx = useContext(ExperimentContext);
  if (!ctx) throw new Error("useExperiment must be used within ExperimentLayout");
  return ctx;
}

// =============================================================================
// STATUS DISPLAY
// =============================================================================

const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-muted text-muted-foreground", label: "Draft" },
  running: { color: "bg-blue-100 text-blue-800", label: "Running" },
  paused: { color: "bg-amber-100 text-amber-800", label: "Paused" },
  completed: { color: "bg-green-100 text-green-800", label: "Completed" },
  failed: { color: "bg-red-100 text-red-800", label: "Failed" },
  cancelled: { color: "bg-muted text-muted-foreground", label: "Cancelled" },
};

// =============================================================================
// TABS
// =============================================================================

const tabs = [
  { label: "Overview", href: "" },
  { label: "Results", href: "/results" },
  { label: "Judgments", href: "/judgments" },
  { label: "Analysis", href: "/analysis" },
  { label: "Export", href: "/export" },
];

// =============================================================================
// LAYOUT
// =============================================================================

export default function ExperimentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const [data, setData] = useState<ExperimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optimisticRef = useRef<{ status: string; until: number } | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/experiments/${id}`);
    if (res.ok) {
      const json = await res.json();
      const serverData = json.data as ExperimentData;

      const opt = optimisticRef.current;
      if (opt && Date.now() < opt.until && serverData.status !== opt.status) {
        setData((prev) => (prev ? { ...serverData, status: opt.status } : serverData));
      } else {
        if (opt && (Date.now() >= opt.until || serverData.status === opt.status)) {
          optimisticRef.current = null;
        }
        setData(serverData);
      }
      return serverData;
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
    if (!shouldPoll) return;

    const poll = async () => {
      const updated = await fetchData();
      if (!updated) return;
      const opt = optimisticRef.current;
      const effectiveStatus = opt && Date.now() < opt.until ? opt.status : updated.status;
      if (effectiveStatus !== "running" && effectiveStatus !== "paused") {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [data?.status, fetchData]);

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

  const statusInfo = statusConfig[data.status] ?? statusConfig.draft;
  const isActive = data.status === "running" || data.status === "paused";
  const basePath = `/dashboard/experiments/${id}`;

  // Determine active tab from pathname
  const activeSuffix = pathname.replace(basePath, "").split("/")[1] ?? "";
  const activeHref = activeSuffix ? `/${activeSuffix}` : "";

  return (
    <ExperimentContext.Provider value={{ data, loading, fetchData, optimisticRef }}>
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
            {isActive && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {statusInfo.label}
          </Badge>
        </div>

        {/* Tab navigation */}
        <nav className="flex gap-1 border-b overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={`${basePath}${tab.href}`}
              className={cn(
                "px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                activeHref === tab.href
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {/* Tab content */}
        {children}
      </div>
    </ExperimentContext.Provider>
  );
}

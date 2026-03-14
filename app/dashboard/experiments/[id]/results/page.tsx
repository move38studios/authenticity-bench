"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { useExperiment } from "../layout";

// =============================================================================
// TYPES
// =============================================================================

interface DilemmaInfo {
  dilemmaId: string;
  title: string | null;
}

interface Stats {
  overview: { total: number | null; completed: number; failed: number };
  dilemmas: DilemmaInfo[];
  byStatus: Array<{ status: string; count: number }>;
  byModel: Array<{ modelConfigId: string; displayName: string; provider: string; count: number; completedCount: number }>;
  byChoice: Array<{ choice: string | null; count: number }>;
  byRefusalType: Array<{ refusalType: string | null; count: number }>;
  byMode: Array<{ judgmentMode: string; count: number; completedCount: number }>;
  byValuesSystem: Array<{ valuesSystemId: string | null; name: string | null; count: number }>;
  confidenceStats: Array<{ modelConfigId: string; displayName: string; avgConfidence: number; minConfidence: number; maxConfidence: number }>;
  choiceByModel: Array<{ modelConfigId: string; displayName: string; choice: string | null; count: number }>;
  choiceByValues: Array<{ valuesSystemId: string | null; valuesName: string | null; choice: string | null; count: number }>;
}

// =============================================================================
// COLORS
// =============================================================================

const CHART_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

const REFUSAL_COLORS: Record<string, string> = {
  none: "#22c55e",
  conditional: "#f59e0b",
  soft: "#f97316",
  hard: "#ef4444",
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: experiment } = useExperiment();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dilemmaFilter, setDilemmaFilter] = useState("all");

  const fetchStats = useCallback(
    (dilemmaId?: string) => {
      const params = new URLSearchParams();
      if (dilemmaId && dilemmaId !== "all") params.set("dilemmaId", dilemmaId);
      return fetch(`/api/experiments/${id}/judgments/stats?${params}`)
        .then((r) => r.json())
        .then((json) => setStats(json.data));
    },
    [id]
  );

  // Initial load
  useEffect(() => {
    fetchStats(dilemmaFilter).finally(() => setLoading(false));
  }, [fetchStats, dilemmaFilter]);

  // Live polling while running
  useEffect(() => {
    if (!experiment || experiment.status === "draft") return;
    if (experiment.status !== "running" && experiment.status !== "paused") return;

    const interval = setInterval(() => fetchStats(dilemmaFilter), 5000);
    return () => clearInterval(interval);
  }, [fetchStats, dilemmaFilter, experiment?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return <p className="text-muted-foreground py-10 text-center">Failed to load stats.</p>;

  const completedTotal = stats.byChoice.reduce((s, r) => s + Number(r.count), 0);
  const total = stats.overview.total ?? 0;
  const hasMultipleDilemmas = stats.dilemmas.length > 1;
  // Choice-specific charts only make sense within a single dilemma
  const showChoiceCharts = !hasMultipleDilemmas || dilemmaFilter !== "all";

  if (completedTotal === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">No completed judgments yet.</p>
        {total > 0 && (
          <p className="text-muted-foreground text-sm mt-1">
            {total.toLocaleString()} judgments configured — run the experiment from the Overview tab.
          </p>
        )}
      </div>
    );
  }

  // Build chart data
  const choiceByModelData = buildCrossTab(
    stats.choiceByModel,
    (r) => r.choice ?? "no_choice",
    (r) => r.displayName ?? r.modelConfigId.slice(0, 8),
    (r) => Number(r.count)
  );

  const choiceByValuesData = buildCrossTab(
    stats.choiceByValues,
    (r) => r.choice ?? "no_choice",
    (r) => r.valuesName ?? (r.valuesSystemId === null ? "Baseline" : r.valuesSystemId.slice(0, 8)),
    (r) => Number(r.count)
  );

  const confidenceData = stats.confidenceStats.map((r) => ({
    name: r.displayName ?? r.modelConfigId.slice(0, 8),
    avg: Number(Number(r.avgConfidence).toFixed(2)),
    min: Number(Number(r.minConfidence).toFixed(2)),
    max: Number(Number(r.maxConfidence).toFixed(2)),
  }));

  const refusalData = stats.byRefusalType.map((r) => ({
    name: r.refusalType ?? "unknown",
    count: Number(r.count),
  }));

  return (
    <div className="space-y-6">
      {/* Filters and status */}
      <div className="flex flex-wrap items-center gap-4">
        {hasMultipleDilemmas && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Dilemma</span>
            <Select value={dilemmaFilter} onValueChange={setDilemmaFilter}>
              <SelectTrigger className="w-[250px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dilemmas</SelectItem>
                {stats.dilemmas.map((d) => (
                  <SelectItem key={d.dilemmaId} value={d.dilemmaId}>
                    {d.title ?? d.dilemmaId.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {total > 0 && completedTotal < total && (
          <div className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-1.5">
            {completedTotal.toLocaleString()} of {total.toLocaleString()} judgments
            {experiment?.status === "running" && " — updating live"}
          </div>
        )}
      </div>

      {/* Choice-specific charts — only shown for a single dilemma */}
      {showChoiceCharts ? (
        <>
          {/* Choice Distribution by Model */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choice Distribution by Model</CardTitle>
              <CardDescription>How each model responded across conditions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={choiceByModelData.data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    {choiceByModelData.series.map((key, i) => (
                      <Bar key={key} dataKey={key} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Values System Effect */}
          {choiceByValuesData.series.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Values System Effect</CardTitle>
                <CardDescription>How values systems shift choice distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={choiceByValuesData.data}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      {choiceByValuesData.series.map((key, i) => (
                        <Bar key={key} dataKey={key} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
          Select a specific dilemma above to see choice distribution charts. Each dilemma has different options, so choice data can only be compared within a single dilemma.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence by Model */}
        {confidenceData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Confidence by Model</CardTitle>
              <CardDescription>Average, min, and max confidence per model</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={confidenceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="min" fill="#94a3b8" name="Min" />
                    <Bar dataKey="avg" fill="#3b82f6" name="Avg" />
                    <Bar dataKey="max" fill="#22c55e" name="Max" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Refusal Breakdown */}
        {refusalData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Refusal Breakdown</CardTitle>
              <CardDescription>Classification of how models engaged with dilemmas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={refusalData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count">
                      {refusalData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={REFUSAL_COLORS[entry.name] ?? "#94a3b8"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CROSS-TAB HELPER
// =============================================================================

function buildCrossTab<T>(
  rows: T[],
  getCategory: (r: T) => string,
  getGroup: (r: T) => string,
  getCount: (r: T) => number
): { data: Record<string, unknown>[]; series: string[] } {
  const groups = new Set<string>();
  const categories = new Map<string, Record<string, number>>();

  for (const row of rows) {
    const cat = getCategory(row);
    const grp = getGroup(row);
    const cnt = getCount(row);
    groups.add(grp);
    if (!categories.has(cat)) categories.set(cat, {});
    categories.get(cat)![grp] = (categories.get(cat)![grp] ?? 0) + cnt;
  }

  const series = Array.from(groups).sort();
  const data = Array.from(categories.entries()).map(([cat, counts]) => ({
    name: cat,
    ...counts,
  }));

  return { data, series };
}

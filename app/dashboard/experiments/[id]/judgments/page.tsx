"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useExperiment } from "../layout";

// =============================================================================
// TYPES
// =============================================================================

interface JudgmentRow {
  id: string;
  status: string;
  dilemmaId: string;
  modelConfigId: string;
  valuesSystemId: string | null;
  mentalTechniqueIds: string[];
  modifierIds: string[];
  judgmentMode: string;
  noiseIndex: number;
  refusalType: string | null;
  choice: string | null;
  reasoning: string | null;
  confidence: number | null;
  errorMessage: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  costEstimate: number | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface LookupItem {
  id: string;
  label: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const statusVariant: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  refused: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
};

const modeLabels: Record<string, string> = {
  theory: "Theory",
  "single-shot-action": "Action",
  "inquiry-to-action": "Inquiry",
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function JudgmentsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: experiment } = useExperiment();
  const [rows, setRows] = useState<JudgmentRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Lookup maps for display names
  const [dilemmas, setDilemmas] = useState<LookupItem[]>([]);
  const [models, setModels] = useState<LookupItem[]>([]);
  const [dilemmaMap, setDilemmaMap] = useState<Map<string, string>>(new Map());
  const [modelMap, setModelMap] = useState<Map<string, string>>(new Map());

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [refusalFilter, setRefusalFilter] = useState("all");
  const [dilemmaFilter, setDilemmaFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Fetch lookup data on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/dilemmas").then((r) => r.json()),
      fetch("/api/models").then((r) => r.json()),
    ]).then(([dilemmaJson, modelJson]) => {
      const dList: LookupItem[] = (dilemmaJson.data ?? []).map((d: { id: string; title: string }) => ({
        id: d.id,
        label: d.title,
      }));
      const mList: LookupItem[] = (modelJson.data ?? []).map((m: { id: string; displayName: string }) => ({
        id: m.id,
        label: m.displayName,
      }));

      // Filter to only items in this experiment
      const expDilemmaIds = new Set(experiment?.dilemmaIds ?? []);
      const expModelIds = new Set(experiment?.modelConfigIds ?? []);
      const filteredDilemmas = dList.filter((d) => expDilemmaIds.has(d.id));
      const filteredModels = mList.filter((m) => expModelIds.has(m.id));

      setDilemmas(filteredDilemmas);
      setModels(filteredModels);
      setDilemmaMap(new Map(filteredDilemmas.map((d) => [d.id, d.label])));
      setModelMap(new Map(filteredModels.map((m) => [m.id, m.label])));
    });
  }, [experiment?.dilemmaIds, experiment?.modelConfigIds]);

  const fetchJudgments = useCallback(
    async (page = 1) => {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "50");
      params.set("sort", sort);
      params.set("order", order);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (modeFilter !== "all") params.set("judgmentMode", modeFilter);
      if (refusalFilter !== "all") params.set("refusalType", refusalFilter);
      if (dilemmaFilter !== "all") params.set("dilemmaId", dilemmaFilter);
      if (modelFilter !== "all") params.set("modelConfigId", modelFilter);

      const res = await fetch(`/api/experiments/${id}/judgments?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data.judgments);
        setPagination(json.data.pagination);
      }
    },
    [id, statusFilter, modeFilter, refusalFilter, dilemmaFilter, modelFilter, sort, order]
  );

  useEffect(() => {
    setLoading(true);
    fetchJudgments(1).finally(() => setLoading(false));
  }, [fetchJudgments]);

  function handleSort(field: string) {
    if (sort === field) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder("desc");
    }
  }

  const sortIndicator = (field: string) =>
    sort === field ? (order === "asc" ? " \u2191" : " \u2193") : "";

  const hasMultipleDilemmas = dilemmas.length > 1;
  const hasMultipleModels = models.length > 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {hasMultipleDilemmas && (
          <FilterSelect
            label="Dilemma"
            value={dilemmaFilter}
            onChange={setDilemmaFilter}
            options={[
              { value: "all", label: "All" },
              ...dilemmas.map((d) => ({ value: d.id, label: d.label })),
            ]}
            width="w-[200px]"
          />
        )}
        {hasMultipleModels && (
          <FilterSelect
            label="Model"
            value={modelFilter}
            onChange={setModelFilter}
            options={[
              { value: "all", label: "All" },
              ...models.map((m) => ({ value: m.id, label: m.label })),
            ]}
            width="w-[180px]"
          />
        )}
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All" },
            { value: "completed", label: "Completed" },
            { value: "refused", label: "Refused" },
            { value: "error", label: "Error" },
            { value: "pending", label: "Pending" },
          ]}
        />
        <FilterSelect
          label="Mode"
          value={modeFilter}
          onChange={setModeFilter}
          options={[
            { value: "all", label: "All" },
            { value: "theory", label: "Theory" },
            { value: "single-shot-action", label: "Action" },
            { value: "inquiry-to-action", label: "Inquiry" },
          ]}
        />
        <FilterSelect
          label="Refusal"
          value={refusalFilter}
          onChange={setRefusalFilter}
          options={[
            { value: "all", label: "All" },
            { value: "none", label: "None" },
            { value: "conditional", label: "Conditional" },
            { value: "soft", label: "Soft" },
            { value: "hard", label: "Hard" },
          ]}
        />
        <div className="ml-auto text-sm text-muted-foreground self-center">
          {pagination.total.toLocaleString()} judgments
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          No judgments match the current filters.
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Status</TableHead>
                  {hasMultipleModels && <TableHead>Model</TableHead>}
                  {hasMultipleDilemmas && <TableHead>Dilemma</TableHead>}
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("judgmentMode")}
                  >
                    Mode{sortIndicator("judgmentMode")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("choice")}
                  >
                    Choice{sortIndicator("choice")}
                  </TableHead>
                  <TableHead>Refusal</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("confidence")}
                  >
                    Conf{sortIndicator("confidence")}
                  </TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Noise</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right hidden md:table-cell"
                    onClick={() => handleSort("latencyMs")}
                  >
                    Latency{sortIndicator("latencyMs")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right hidden lg:table-cell"
                    onClick={() => handleSort("costEstimate")}
                  >
                    Cost{sortIndicator("costEstimate")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="group">
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${statusVariant[row.status] ?? ""}`}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    {hasMultipleModels && (
                      <TableCell className="text-sm truncate max-w-[150px]" title={modelMap.get(row.modelConfigId) ?? row.modelConfigId}>
                        {modelMap.get(row.modelConfigId) ?? row.modelConfigId.slice(0, 8)}
                      </TableCell>
                    )}
                    {hasMultipleDilemmas && (
                      <TableCell className="text-sm truncate max-w-[150px]" title={dilemmaMap.get(row.dilemmaId) ?? row.dilemmaId}>
                        {dilemmaMap.get(row.dilemmaId) ?? row.dilemmaId.slice(0, 8)}
                      </TableCell>
                    )}
                    <TableCell className="text-sm">
                      {modeLabels[row.judgmentMode] ?? row.judgmentMode}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/experiments/${id}/judgments/${row.id}`}
                        className="text-sm font-mono hover:underline"
                      >
                        {row.choice ?? (row.errorMessage ? "error" : "—")}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.refusalType && row.refusalType !== "none" ? (
                        <Badge variant="outline" className="text-[10px]">
                          {row.refusalType}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.confidence != null ? row.confidence.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                      {row.noiseIndex}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden md:table-cell">
                      {row.latencyMs != null ? `${(row.latencyMs / 1000).toFixed(1)}s` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                      {row.costEstimate != null ? `$${row.costEstimate.toFixed(4)}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchJudgments(pagination.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchJudgments(pagination.page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// FILTER SELECT
// =============================================================================

function FilterSelect({
  label,
  value,
  onChange,
  options,
  width = "w-[120px]",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  width?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={`${width} h-8 text-xs`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Play, RefreshCw } from "lucide-react";

interface ModelConfig {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
}

interface ModelGroup {
  provider: string;
  models: { id: string; label: string }[];
}

function groupModels(rows: ModelConfig[]): ModelGroup[] {
  const map = new Map<string, { id: string; label: string }[]>();
  for (const r of rows) {
    const fullId = `${r.provider}/${r.modelId}`;
    const group = r.provider.charAt(0).toUpperCase() + r.provider.slice(1);
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push({ id: fullId, label: r.displayName });
  }
  return Array.from(map, ([provider, models]) => ({ provider, models }));
}

const statusColors: Record<string, string> = {
  started: "bg-blue-100 text-blue-800",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default function TestWorkflowPage() {
  const [groups, setGroups] = useState<ModelGroup[]>([]);
  const [modelId, setModelId] = useState("anthropic/claude-haiku-4.5");
  const [prompt, setPrompt] = useState(
    "Say hello and tell me a one-sentence fun fact about workflows."
  );
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [runData, setRunData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((json) => {
        const rows: ModelConfig[] = json.data ?? json;
        setGroups(groupModels(rows));
      });
  }, []);

  // Poll for execution status
  useEffect(() => {
    if (!runId) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/admin/test-workflow?id=${runId}`
        );
        const json = await res.json();
        if (res.ok && json.data) {
          setRunData(json.data);
          const status = json.data.status;
          if (status === "completed" || status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        // ignore poll errors
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runId]);

  async function handleStart() {
    setLoading(true);
    setError("");
    setRunId(null);
    setRunData(null);

    try {
      const res = await fetch("/api/admin/test-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, prompt }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to start workflow");
      } else {
        setRunId(json.data.runId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setLoading(false);
    }
  }

  const status = (runData as { status?: string })?.status;
  const isRunning = status === "started" || status === "running";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Workflow Test
        </h1>
        <p className="text-muted-foreground mt-1">
          Test the Vercel WDK workflow infrastructure. Runs a simple workflow
          with validation, sleep, LLM call, and parallel batch steps.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Choose a model and prompt to test the workflow pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <div key={g.provider}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {g.provider}
                      </div>
                      {g.models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleStart} disabled={loading || isRunning}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Workflow
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {runId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Execution
              {status && (
                <Badge
                  variant="secondary"
                  className={statusColors[status] ?? ""}
                >
                  {isRunning && (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  )}
                  {status}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              {runId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isRunning && !runData && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Polling for results...
              </div>
            )}
            {runData && (
              <pre className="text-xs font-mono bg-muted rounded-lg p-4 overflow-auto max-h-96">
                {JSON.stringify(runData, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

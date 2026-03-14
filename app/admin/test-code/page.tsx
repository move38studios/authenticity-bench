"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const EXAMPLES: { label: string; code: string }[] = [
  {
    label: "Hello World",
    code: 'print("Hello from Python sandbox!")',
  },
  {
    label: "NumPy stats",
    code: `import numpy as np

data = np.random.randn(1000)
print(f"Mean:   {data.mean():.4f}")
print(f"Std:    {data.std():.4f}")
print(f"Min:    {data.min():.4f}")
print(f"Max:    {data.max():.4f}")
print(f"Median: {np.median(data):.4f}")`,
  },
  {
    label: "Matplotlib chart",
    code: `import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import base64, io

x = np.linspace(0, 10, 100)
y = np.sin(x) * np.exp(-x / 5)

fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(x, y, "b-", linewidth=2)
ax.set_title("Damped Sine Wave")
ax.set_xlabel("x")
ax.set_ylabel("y")
ax.grid(True, alpha=0.3)

buf = io.BytesIO()
fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
buf.seek(0)
b64 = base64.b64encode(buf.read()).decode()
print(f"__IMAGE__:{b64}")`,
  },
];

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  latencyMs: number;
}

export default function TestCodePage() {
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");

  async function handleRun() {
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/test-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(`${res.status}: ${json.error}`);
      } else {
        setResult(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function renderOutput(text: string) {
    // Check for embedded images (__IMAGE__:base64...)
    const parts = text.split(/(__IMAGE__:[^\n]+)/);
    return parts.map((part, i) => {
      if (part.startsWith("__IMAGE__:")) {
        const b64 = part.slice("__IMAGE__:".length);
        return (
          <img
            key={i}
            src={`data:image/png;base64,${b64}`}
            alt="Chart output"
            className="max-w-full rounded-md border mt-2"
          />
        );
      }
      return part ? <span key={i}>{part}</span> : null;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Code Sandbox</h1>
        <p className="text-muted-foreground mt-1">
          Run Python code in an isolated Vercel Sandbox. Nothing is saved.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Python Code</span>
              <div className="flex gap-1">
                {EXAMPLES.map((ex) => (
                  <Button
                    key={ex.label}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setCode(ex.code)}
                  >
                    {ex.label}
                  </Button>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={18}
              className="font-mono text-xs"
              placeholder="print('Hello world')"
            />
            <Button onClick={handleRun} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Running...
                </>
              ) : (
                "Run Code"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Output</CardTitle>
          </CardHeader>
          <CardContent>
            {!result && !error && !loading && (
              <p className="text-sm text-muted-foreground">
                Run some code to see the output here.
              </p>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing in sandbox...
              </div>
            )}

            {error && (
              <pre className="text-xs bg-destructive/10 text-destructive p-3 rounded-md overflow-auto whitespace-pre-wrap">
                {error}
              </pre>
            )}

            {result && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Stat
                    label="Exit Code"
                    value={String(result.exitCode)}
                    variant={result.exitCode === 0 ? "success" : "error"}
                  />
                  <Stat label="Latency" value={`${result.latencyMs}ms`} />
                </div>

                {result.stdout && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      stdout
                    </div>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto whitespace-pre-wrap max-h-[500px]">
                      {renderOutput(result.stdout)}
                    </pre>
                  </div>
                )}

                {result.stderr && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      stderr
                    </div>
                    <pre className="text-xs bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-md overflow-auto whitespace-pre-wrap max-h-[300px]">
                      {result.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "success" | "error";
}) {
  const bg =
    variant === "success"
      ? "bg-green-50 border-green-200"
      : variant === "error"
        ? "bg-red-50 border-red-200"
        : "bg-muted";
  return (
    <div className={`rounded-md px-3 py-2 border ${bg}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-mono">{value}</div>
    </div>
  );
}

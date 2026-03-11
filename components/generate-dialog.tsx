"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";

interface GenerateDialogProps {
  entityType: "dilemma" | "values_system" | "mental_technique" | "modifier";
  entityLabel: string;
  onGenerated: () => void;
  /** API path to POST individual items to, e.g. "/api/dilemmas" */
  createApiPath: string;
  /** Map generated item fields to the API's expected body */
  mapToCreateBody: (item: Record<string, unknown>) => Record<string, unknown>;
}

interface ModelConfig {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
}

const DEFAULT_MODEL_ID = "anthropic/claude-sonnet-4-6";

const PLACEHOLDER_BRIEFS: Record<string, string> = {
  dilemma:
    "Generate diverse ethical dilemmas spanning medical, business, and personal domains. Include scenarios with genuine moral tension.",
  values_system:
    "Generate diverse ethical frameworks: include both Western philosophical traditions and non-Western perspectives.",
  mental_technique:
    "Generate diverse thinking techniques: contemplation, structured debate, perspective-taking, emotional awareness, etc.",
  modifier:
    "Generate situational modifiers: time pressure, authority presence, public scrutiny, high stakes consequences, etc.",
};

export function GenerateDialog({
  entityType,
  entityLabel,
  onGenerated,
  createApiPath,
  mapToCreateBody,
}: GenerateDialogProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState("5");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<Record<string, unknown>[] | null>(
    null
  );
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (open && models.length === 0) {
      fetch("/api/models")
        .then((r) => r.json())
        .then((json) => {
          const data = (json.data ?? []) as ModelConfig[];
          setModels(data);
          // Default to Sonnet 4.6 if available, otherwise first model
          const defaultModel = data.find(
            (m) => `${m.provider}/${m.modelId}` === DEFAULT_MODEL_ID
          );
          if (defaultModel) {
            setModelId(`${defaultModel.provider}/${defaultModel.modelId}`);
          } else if (data.length > 0) {
            setModelId(`${data[0].provider}/${data[0].modelId}`);
          }
        })
        .catch(() => {});
    }
  }, [open, models.length]);

  function reset() {
    setBrief("");
    setCount("5");
    setError("");
    setGenerated(null);
    setSavedCount(0);
    setLoading(false);
    setSaving(false);
  }

  async function handleGenerate() {
    setError("");
    setGenerated(null);
    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          modelId,
          brief: brief.trim() || undefined,
          count: parseInt(count) || 5,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Generation failed");
      } else {
        setGenerated(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAll() {
    if (!generated) return;
    setSaving(true);
    setError("");
    let saved = 0;

    for (const item of generated) {
      try {
        const body = mapToCreateBody(item);
        const res = await fetch(createApiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) saved++;
      } catch {
        // continue saving others
      }
    }

    setSavedCount(saved);
    setSaving(false);

    if (saved > 0) {
      onGenerated();
      // Brief delay so user sees the count, then close
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1000);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate {entityLabel}</DialogTitle>
          <DialogDescription>
            Use AI to generate {entityLabel.toLowerCase()} from a brief
            description.
          </DialogDescription>
        </DialogHeader>

        {!generated ? (
          // Configuration form
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => {
                      const value = `${m.provider}/${m.modelId}`;
                      return (
                        <SelectItem key={m.id} value={value}>
                          {m.displayName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Count</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Brief</Label>
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={PLACEHOLDER_BRIEFS[entityType]}
                rows={4}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate {count} {entityLabel}
                </>
              )}
            </Button>
          </div>
        ) : (
          // Preview generated items
          <div className="space-y-4 pt-2">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {generated.map((item, i) => (
                <GeneratedItemPreview
                  key={i}
                  item={item}
                  index={i}
                  entityType={entityType}
                />
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {savedCount > 0 && (
              <p className="text-sm text-green-600 font-medium">
                Saved {savedCount} of {generated.length} items.
              </p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSaveAll}
                disabled={saving || savedCount > 0}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : savedCount > 0 ? (
                  "Saved!"
                ) : (
                  `Save All ${generated.length} to Library`
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setGenerated(null);
                  setError("");
                }}
                disabled={saving}
              >
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GeneratedItemPreview({
  item,
  index,
  entityType,
}: {
  item: Record<string, unknown>;
  index: number;
  entityType: string;
}) {
  const title =
    (item.title as string) ?? (item.name as string) ?? `Item ${index + 1}`;
  const description = (item.description as string) ?? undefined;
  const domain = (item.domain as string) ?? undefined;

  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">
          {index + 1}
        </span>
        <span className="font-medium text-sm">{title}</span>
        {domain && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {domain}
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {entityType === "dilemma" && Array.isArray(item.options) && (
        <div className="space-y-1 pt-1">
          {(item.options as { slug: string; label: string }[]).map((opt, j) => (
            <div key={j} className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground bg-muted rounded px-1 py-0.5">
                {opt.slug}
              </span>
              <span className="text-xs">{opt.label}</span>
            </div>
          ))}
        </div>
      )}
      {(item.content || item.scenario) ? (
        <p className="text-xs text-muted-foreground line-clamp-2 pt-1">
          {(item.content as string) ?? (item.scenario as string)}
        </p>
      ) : null}
    </div>
  );
}

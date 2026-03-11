"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Plus,
  X,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";

interface DilemmaOption {
  slug: string;
  label: string;
  description: string;
  actionTool: { name: string; description: string; parameters?: Record<string, unknown> } | null;
}

interface ModelConfig {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
}

const DEFAULT_MODEL_ID = "anthropic/claude-sonnet-4-6";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export default function DilemmaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [scenario, setScenario] = useState("");
  const [domain, setDomain] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [options, setOptions] = useState<DilemmaOption[]>([
    { slug: "", label: "", description: "", actionTool: null },
    { slug: "", label: "", description: "", actionTool: null },
  ]);
  const [isPublic, setIsPublic] = useState(true);
  const [inquiryToolsJson, setInquiryToolsJson] = useState("");

  // Inquiry tool generation
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [toolModelId, setToolModelId] = useState(DEFAULT_MODEL_ID);
  const [generatingTools, setGeneratingTools] = useState(false);
  const [toolError, setToolError] = useState("");

  const fetchItem = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/dilemmas/${id}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const json = await res.json();
    const item = json.data;
    setTitle(item.title ?? "");
    setScenario(item.scenario ?? "");
    setDomain(item.domain ?? "");
    setTagsInput((item.tags ?? []).join(", "));
    setOptions(
      Array.isArray(item.options) && item.options.length >= 2
        ? (item.options as DilemmaOption[])
        : [
            { slug: "", label: "", description: "", actionTool: null },
            { slug: "", label: "", description: "", actionTool: null },
          ]
    );
    setIsPublic(item.isPublic ?? true);
    setInquiryToolsJson(
      item.inquiryTools ? JSON.stringify(item.inquiryTools, null, 2) : ""
    );
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // Fetch models for inquiry tool generation
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((json) => {
        const data = (json.data ?? []) as ModelConfig[];
        setModels(data);
        const defaultModel = data.find(
          (m) => `${m.provider}/${m.modelId}` === DEFAULT_MODEL_ID
        );
        if (defaultModel) {
          setToolModelId(`${defaultModel.provider}/${defaultModel.modelId}`);
        } else if (data.length > 0) {
          setToolModelId(`${data[0].provider}/${data[0].modelId}`);
        }
      })
      .catch(() => {});
  }, []);

  function updateOption(index: number, field: keyof DilemmaOption, value: string) {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (i !== index) return o;
        if (field === "actionTool") return o; // handled separately
        const updated = { ...o, [field]: value };
        return updated;
      })
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const filteredOptions = options.filter((o) => o.label.trim());
    if (filteredOptions.length < 2) {
      setError("At least 2 options are required");
      return;
    }

    // Ensure slugs
    const optionsForSave = filteredOptions.map((o) => ({
      slug: o.slug || slugify(o.label),
      label: o.label.trim(),
      description: o.description.trim() || o.label.trim(),
      actionTool: o.actionTool,
    }));

    const slugs = optionsForSave.map((o) => o.slug);
    if (new Set(slugs).size !== slugs.length) {
      setError("Each option must have a unique slug");
      return;
    }

    let inquiryTools: Record<string, unknown>[] | undefined;
    if (inquiryToolsJson.trim()) {
      try {
        inquiryTools = JSON.parse(inquiryToolsJson);
      } catch {
        setError("Inquiry Tools JSON is invalid");
        return;
      }
    }

    setSaving(true);

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const body: Record<string, unknown> = {
      title,
      scenario,
      options: optionsForSave,
      isPublic,
      tags: parsedTags,
    };
    if (domain) body.domain = domain;
    if (inquiryTools) body.inquiryTools = inquiryTools;

    const res = await fetch(`/api/dilemmas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    } else {
      router.push("/dashboard/library/dilemmas");
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/dilemmas/${id}`, { method: "DELETE" });
    router.push("/dashboard/library/dilemmas");
  }

  async function handleGenerateInquiryTools() {
    setGeneratingTools(true);
    setToolError("");
    try {
      const res = await fetch(`/api/dilemmas/${id}/generate-tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: toolModelId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToolError(json.error ?? "Tool generation failed");
      } else {
        setInquiryToolsJson(JSON.stringify(json.data.inquiryTools, null, 2));
      }
    } catch (e) {
      setToolError(e instanceof Error ? e.message : "Tool generation failed");
    } finally {
      setGeneratingTools(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Dilemma not found.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/library/dilemmas">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>
    );
  }

  const hasInquiryTools = !!inquiryToolsJson.trim();
  const hasActionTools = options.every((o) => o.actionTool != null);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/library/dilemmas">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight truncate">
          {title || "Dilemma"}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Dilemma</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domain (optional)</Label>
                <Input
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. medical, business, personal"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. autonomy, life-death, consent, deception"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scenario">Scenario (markdown)</Label>
              <Textarea
                id="scenario"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Response Options (minimum 2)</Label>
              <p className="text-xs text-muted-foreground">
                Each option has a unique slug (used across all judgment modes), a label, description, and an optional action tool.
                {hasActionTools
                  ? " All options have action tools configured."
                  : " Action tools are auto-generated when using AI generation."}
              </p>
              <div className="space-y-3">
                {options.map((opt, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          Option {i + 1}
                        </span>
                        {opt.actionTool && (
                          <span className="text-xs text-green-600 bg-green-50 rounded px-1.5 py-0.5">
                            {opt.actionTool.name}()
                          </span>
                        )}
                      </div>
                      {options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() =>
                            setOptions((prev) => prev.filter((_, j) => j !== i))
                          }
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={opt.label}
                        onChange={(e) => updateOption(i, "label", e.target.value)}
                        placeholder="Label (e.g. Report the colleague)"
                      />
                      <Input
                        value={opt.slug}
                        onChange={(e) => updateOption(i, "slug", e.target.value)}
                        placeholder="Slug (e.g. report_colleague)"
                        className="font-mono text-sm"
                      />
                    </div>
                    <Input
                      value={opt.description}
                      onChange={(e) => updateOption(i, "description", e.target.value)}
                      placeholder="Description of what choosing this option entails"
                    />
                    {opt.actionTool && (
                      <p className="text-xs text-muted-foreground">
                        Tool: {opt.actionTool.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions((prev) => [
                    ...prev,
                    { slug: "", label: "", description: "", actionTool: null },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Option
              </Button>
            </div>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={isPublic}
                onCheckedChange={(v) => setIsPublic(v === true)}
              />
              <span className="text-sm">
                Public (visible to all users)
              </span>
            </label>

            <div className="space-y-2">
              <Label htmlFor="inquiryTools">
                Inquiry Tools JSON
              </Label>
              <Textarea
                id="inquiryTools"
                value={inquiryToolsJson}
                onChange={(e) => setInquiryToolsJson(e.target.value)}
                rows={6}
                className="font-mono text-xs"
                placeholder="Generate inquiry tools below, or paste JSON manually"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Dilemma"
                  )}
                </Button>
                <Button type="button" variant="ghost" asChild>
                  <Link href="/dashboard/library/dilemmas">Cancel</Link>
                </Button>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={deleting}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Dilemma?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &quot;{title}&quot;. This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Inquiry Tool Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Inquiry Tools
          </CardTitle>
          <CardDescription>
            {hasInquiryTools
              ? "Inquiry tools are configured. You can regenerate them below."
              : "Generate inquiry tools for inquiry-to-action mode. These are information-gathering tools the model can call before deciding."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-2 flex-1">
              <Label>Model</Label>
              <Select value={toolModelId} onValueChange={setToolModelId}>
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
            <Button
              onClick={handleGenerateInquiryTools}
              disabled={generatingTools || !title || !scenario}
              variant={hasInquiryTools ? "outline" : "default"}
            >
              {generatingTools ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {hasInquiryTools ? "Regenerate Inquiry Tools" : "Generate Inquiry Tools"}
                </>
              )}
            </Button>
          </div>
          {toolError && (
            <p className="text-sm text-destructive">{toolError}</p>
          )}
          {!hasInquiryTools && !generatingTools && (
            <p className="text-sm text-muted-foreground">
              Inquiry tools are used in inquiry-to-action judgment mode. They let the model
              gather information before making its decision. Save the dilemma first, then generate tools.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

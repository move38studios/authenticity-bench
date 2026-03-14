"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Loader2, ArrowLeft, ArrowRight, Check, Eye } from "lucide-react";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

interface ModelConfig {
  id: string;
  displayName: string;
  provider: string;
  modelId: string;
}

interface ContentItem {
  id: string;
  name?: string;
  title?: string;
  description?: string | null;
  domain?: string | null;
}

export interface FormState {
  name: string;
  description: string;
  modelConfigIds: string[];
  dilemmaIds: string[];
  judgmentModes: string[];
  valuesSystemIds: string[];
  mentalTechniqueIds: string[];
  modifierIds: string[];
  mentalTechniqueCombos: string[][] | null; // null = auto power set
  modifierCombos: string[][] | null;
  noiseRepeats: number;
}

const STEPS = [
  "Basics",
  "Models",
  "Dilemmas",
  "Modes",
  "Values",
  "Techniques",
  "Modifiers",
  "Repeats",
  "Review",
];

const JUDGMENT_MODES = [
  {
    id: "theory",
    label: "Theory Mode",
    desc: "Hypothetical scenario, text response",
  },
  {
    id: "single-shot-action",
    label: "Single-Shot Action",
    desc: "Model believes it's executing a real action",
  },
  {
    id: "inquiry-to-action",
    label: "Inquiry → Action",
    desc: "Model can gather info before deciding",
  },
];

export const initialForm: FormState = {
  name: "",
  description: "",
  modelConfigIds: [],
  dilemmaIds: [],
  judgmentModes: ["theory"],
  valuesSystemIds: [],
  mentalTechniqueIds: [],
  modifierIds: [],
  mentalTechniqueCombos: null,
  modifierCombos: null,
  noiseRepeats: 3,
};

// =============================================================================
// HELPERS
// =============================================================================

function powerSet<T>(items: T[]): T[][] {
  const result: T[][] = [[]];
  for (const item of items) {
    const len = result.length;
    for (let i = 0; i < len; i++) {
      result.push([...result[i], item]);
    }
  }
  return result;
}

function computeTotal(form: FormState) {
  const mtCombos = form.mentalTechniqueCombos ?? powerSet(form.mentalTechniqueIds);
  const modCombos = form.modifierCombos ?? powerSet(form.modifierIds);
  const mtCount = mtCombos.length || 1;
  const modCount = modCombos.length || 1;

  return (
    form.dilemmaIds.length *
    form.modelConfigIds.length *
    (form.valuesSystemIds.length + 1) *
    mtCount *
    modCount *
    form.judgmentModes.length *
    form.noiseRepeats
  );
}

// =============================================================================
// PROPS
// =============================================================================

interface ExperimentFormProps {
  mode: "create" | "edit";
  initialData?: FormState;
  experimentId?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ExperimentForm({ mode, initialData, experimentId }: ExperimentFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [step, _setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(isEdit ? STEPS.length - 1 : 0);

  function setStep(s: number) {
    _setStep(s);
    setMaxStep((prev) => Math.max(prev, s));
  }
  const [form, setForm] = useState<FormState>(initialData ?? initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");

  // Library data
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [dilemmas, setDilemmas] = useState<ContentItem[]>([]);
  const [values, setValues] = useState<ContentItem[]>([]);
  const [techniques, setTechniques] = useState<ContentItem[]>([]);
  const [modifiers, setModifiers] = useState<ContentItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchLibrary = useCallback(async () => {
    const [m, d, v, t, mod] = await Promise.all([
      fetch("/api/models").then((r) => r.json()),
      fetch("/api/dilemmas").then((r) => r.json()),
      fetch("/api/values").then((r) => r.json()),
      fetch("/api/techniques").then((r) => r.json()),
      fetch("/api/modifiers").then((r) => r.json()),
    ]);
    setModels(m.data ?? []);
    setDilemmas(d.data ?? []);
    setValues(v.data ?? []);
    setTechniques(t.data ?? []);
    setModifiers(mod.data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function toggleInArray(arr: string[], id: string): string[] {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return form.name.trim().length > 0;
      case 1:
        return form.modelConfigIds.length > 0;
      case 2:
        return form.dilemmaIds.length > 0;
      case 3:
        return form.judgmentModes.length > 0;
      default:
        return true;
    }
  }

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      name: form.name,
      judgmentModes: form.judgmentModes,
      noiseRepeats: form.noiseRepeats,
      modelConfigIds: form.modelConfigIds,
      dilemmaIds: form.dilemmaIds,
      valuesSystemIds: form.valuesSystemIds,
      mentalTechniqueIds: form.mentalTechniqueIds,
      modifierIds: form.modifierIds,
    };
    if (form.description) body.description = form.description;
    if (form.mentalTechniqueCombos)
      body.mentalTechniqueCombos = form.mentalTechniqueCombos;
    if (form.modifierCombos) body.modifierCombos = form.modifierCombos;
    return body;
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);

    try {
      const url = isEdit
        ? `/api/experiments/${experimentId}`
        : "/api/experiments";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? `Failed to ${isEdit ? "save" : "create"} experiment`);
      } else {
        if (isEdit) {
          toast.success("Experiment updated");
          router.push(`/dashboard/experiments/${experimentId}`);
        } else {
          router.push(`/dashboard/experiments`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? "save" : "create"}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreview() {
    setError("");
    setPreviewing(true);

    try {
      let targetId = experimentId;

      if (isEdit) {
        // Save changes first
        const res = await fetch(`/api/experiments/${experimentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBody()),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to save experiment");
          return;
        }
      } else {
        // Create experiment as draft
        const res = await fetch("/api/experiments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBody()),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to create experiment");
          return;
        }
        const { data } = await res.json();
        targetId = data.id;
      }

      // Generate preview token
      const tokenRes = await fetch(
        `/api/experiments/${targetId}/preview-token`,
        { method: "POST" }
      );

      if (!tokenRes.ok) {
        setError("Failed to generate preview link");
        return;
      }

      const { data: tokenData } = await tokenRes.json();
      window.open(`/preview/${tokenData.previewToken}`, "_blank");
      toast.success(
        isEdit
          ? "Changes saved. Preview opened in new tab."
          : "Experiment saved as draft. Preview opened in new tab."
      );
      router.push(
        isEdit
          ? `/dashboard/experiments/${experimentId}`
          : "/dashboard/experiments"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create preview");
    } finally {
      setPreviewing(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cancelHref = isEdit
    ? `/dashboard/experiments/${experimentId}`
    : undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {isEdit ? "Edit Experiment" : "New Experiment"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEdit
            ? "Update the experiment configuration."
            : "Configure a benchmark run step by step."}
        </p>
      </div>

      {/* Step indicator — compact on mobile, pills on desktop */}
      <div>
        {/* Mobile: compact progress */}
        <div className="md:hidden space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{STEPS[step]}</span>
            <span className="text-muted-foreground">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Desktop: horizontal pills */}
        <div className="hidden md:flex gap-1">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => i <= maxStep && setStep(i)}
              disabled={i > maxStep}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                ${i === step ? "bg-primary text-primary-foreground" : ""}
                ${i !== step && i <= maxStep ? "bg-muted text-foreground cursor-pointer hover:bg-muted/80" : ""}
                ${i > maxStep ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
              `}
            >
              {i < step && <Check className="h-3 w-3 inline mr-1" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Step 0: Basics */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Experiment Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="e.g. Medical Ethics Baseline v1"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description (optional)</Label>
                <Textarea
                  id="desc"
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="What are you testing?"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 1: Models */}
          {step === 1 && (
            <SelectionStep
              title="Select Models"
              description={`${form.modelConfigIds.length} of ${models.length} selected`}
              items={models.map((m) => ({
                id: m.id,
                label: m.displayName,
                detail: `${m.provider}/${m.modelId}`,
              }))}
              selected={form.modelConfigIds}
              onToggle={(id) =>
                update({ modelConfigIds: toggleInArray(form.modelConfigIds, id) })
              }
              onSelectAll={() =>
                update({
                  modelConfigIds:
                    form.modelConfigIds.length === models.length
                      ? []
                      : models.map((m) => m.id),
                })
              }
              emptyMessage="No models configured. Add them in the Content Library first."
            />
          )}

          {/* Step 2: Dilemmas */}
          {step === 2 && (
            <SelectionStep
              title="Select Dilemmas"
              description={`${form.dilemmaIds.length} of ${dilemmas.length} selected`}
              items={dilemmas.map((d) => ({
                id: d.id,
                label: d.title ?? d.name ?? d.id,
                detail: d.domain ?? undefined,
              }))}
              selected={form.dilemmaIds}
              onToggle={(id) =>
                update({ dilemmaIds: toggleInArray(form.dilemmaIds, id) })
              }
              onSelectAll={() =>
                update({
                  dilemmaIds:
                    form.dilemmaIds.length === dilemmas.length
                      ? []
                      : dilemmas.map((d) => d.id),
                })
              }
              emptyMessage="No dilemmas yet. Create them in the Content Library first."
            />
          )}

          {/* Step 3: Judgment Modes */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Judgment Modes</h3>
                <p className="text-sm text-muted-foreground">
                  How dilemmas are presented to models. Select at least one.
                </p>
              </div>
              <div className="space-y-3">
                {JUDGMENT_MODES.map((jm) => (
                  <label
                    key={jm.id}
                    className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={form.judgmentModes.includes(jm.id)}
                      onCheckedChange={() =>
                        update({
                          judgmentModes: toggleInArray(
                            form.judgmentModes,
                            jm.id
                          ),
                        })
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium text-sm">{jm.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {jm.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Values Systems */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Values Systems</h3>
                <p className="text-sm text-muted-foreground">
                  A &quot;no values&quot; baseline is always included. Select
                  additional values systems to test.
                </p>
              </div>
              {values.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No values systems yet. You can skip this step or create them
                  in the Content Library.
                </p>
              ) : (
                <>
                  <SelectAllButton
                    allSelected={form.valuesSystemIds.length === values.length}
                    onToggle={() =>
                      update({
                        valuesSystemIds:
                          form.valuesSystemIds.length === values.length
                            ? []
                            : values.map((v) => v.id),
                      })
                    }
                  />
                  <div className="space-y-2">
                    {values.map((v) => (
                      <CheckboxItem
                        key={v.id}
                        label={v.name ?? v.id}
                        detail={v.description ?? undefined}
                        checked={form.valuesSystemIds.includes(v.id)}
                        onToggle={() =>
                          update({
                            valuesSystemIds: toggleInArray(
                              form.valuesSystemIds,
                              v.id
                            ),
                          })
                        }
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 5: Mental Techniques */}
          {step === 5 && (
            <ComboStep
              title="Mental Techniques"
              description="Select techniques and configure combinations. The power set of all combinations is generated by default."
              items={techniques}
              selectedIds={form.mentalTechniqueIds}
              combos={form.mentalTechniqueCombos}
              onToggleId={(id) =>
                update({
                  mentalTechniqueIds: toggleInArray(
                    form.mentalTechniqueIds,
                    id
                  ),
                  mentalTechniqueCombos: null, // reset to auto
                })
              }
              onSelectAll={() => {
                const allSelected =
                  form.mentalTechniqueIds.length === techniques.length;
                update({
                  mentalTechniqueIds: allSelected
                    ? []
                    : techniques.map((t) => t.id),
                  mentalTechniqueCombos: null,
                });
              }}
              onRemoveCombo={(idx) => {
                const current =
                  form.mentalTechniqueCombos ??
                  powerSet(form.mentalTechniqueIds);
                update({
                  mentalTechniqueCombos: current.filter((_, i) => i !== idx),
                });
              }}
              onResetCombos={() =>
                update({ mentalTechniqueCombos: null })
              }
              nameMap={Object.fromEntries(
                techniques.map((t) => [t.id, t.name ?? t.id])
              )}
            />
          )}

          {/* Step 6: Modifiers */}
          {step === 6 && (
            <ComboStep
              title="Modifiers"
              description="Select modifiers and configure combinations. The power set is generated by default."
              items={modifiers}
              selectedIds={form.modifierIds}
              combos={form.modifierCombos}
              onToggleId={(id) =>
                update({
                  modifierIds: toggleInArray(form.modifierIds, id),
                  modifierCombos: null,
                })
              }
              onSelectAll={() => {
                const allSelected =
                  form.modifierIds.length === modifiers.length;
                update({
                  modifierIds: allSelected ? [] : modifiers.map((m) => m.id),
                  modifierCombos: null,
                });
              }}
              onRemoveCombo={(idx) => {
                const current =
                  form.modifierCombos ?? powerSet(form.modifierIds);
                update({
                  modifierCombos: current.filter((_, i) => i !== idx),
                });
              }}
              onResetCombos={() => update({ modifierCombos: null })}
              nameMap={Object.fromEntries(
                modifiers.map((m) => [m.id, m.name ?? m.id])
              )}
            />
          )}

          {/* Step 7: Noise Repeats */}
          {step === 7 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Noise Repeats</h3>
                <p className="text-sm text-muted-foreground">
                  How many times each configuration is run with paraphrased
                  variants. More repeats = higher confidence but more API
                  calls. Index 0 is always the original text.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Input
                  value={form.noiseRepeats}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (e.target.value === "") {
                      update({ noiseRepeats: 0 as unknown as number });
                      return;
                    }
                    if (isNaN(val) || val < 1) {
                      toast.error("Must be at least 1");
                      return;
                    }
                    update({ noiseRepeats: val });
                  }}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  repeats per configuration
                </span>
              </div>
            </div>
          )}

          {/* Step 8: Review */}
          {step === 8 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">
                  {isEdit ? "Review & Save" : "Review & Create"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Confirm your experiment configuration.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ReviewStat label="Name" value={form.name} className="col-span-2" />
                <ReviewStat
                  label="Models"
                  value={`${form.modelConfigIds.length}`}
                />
                <ReviewStat
                  label="Dilemmas"
                  value={`${form.dilemmaIds.length}`}
                />
                <ReviewStat
                  label="Judgment Modes"
                  value={form.judgmentModes.join(", ")}
                  className="col-span-2"
                />
                <ReviewStat
                  label="Values Systems"
                  value={`${form.valuesSystemIds.length} + baseline`}
                />
                <ReviewStat
                  label="Noise Repeats"
                  value={`${form.noiseRepeats}`}
                />
                <ReviewStat
                  label="Technique Combos"
                  value={`${(form.mentalTechniqueCombos ?? powerSet(form.mentalTechniqueIds)).length}`}
                />
                <ReviewStat
                  label="Modifier Combos"
                  value={`${(form.modifierCombos ?? powerSet(form.modifierIds)).length}`}
                />
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                <div className="text-sm font-medium text-primary">
                  Total Judgments
                </div>
                <div className="text-3xl font-mono font-bold text-primary mt-1">
                  {computeTotal(form).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1 break-words">
                  {form.dilemmaIds.length} dilemmas
                  {" × "}{form.modelConfigIds.length} models
                  {" × "}{form.valuesSystemIds.length + 1} values
                  {" × "}{(form.mentalTechniqueCombos ?? powerSet(form.mentalTechniqueIds)).length} technique combos
                  {" × "}{(form.modifierCombos ?? powerSet(form.modifierIds)).length} modifier combos
                  {" × "}{form.judgmentModes.length} modes
                  {" × "}{form.noiseRepeats} repeats
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewing || submitting}
                >
                  {previewing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {isEdit ? "Saving & previewing..." : "Creating preview..."}
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Launch Preview
                    </>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {isEdit
                    ? "Saves changes &amp; opens a shareable preview link"
                    : "Saves as draft &amp; opens a shareable preview link"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            if (step === 0) {
              if (cancelHref) {
                router.push(cancelHref);
              } else {
                router.back();
              }
            } else {
              setStep(step - 1);
            }
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {isEdit ? "Saving..." : "Creating..."}
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {isEdit ? "Save Changes" : "Create Experiment"}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SelectionStep({
  title,
  description,
  items,
  selected,
  onToggle,
  onSelectAll,
  emptyMessage,
}: {
  title: string;
  description: string;
  items: { id: string; label: string; detail?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  emptyMessage: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {items.length > 0 && (
          <SelectAllButton
            allSelected={selected.length === items.length}
            onToggle={onSelectAll}
          />
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{emptyMessage}</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {items.map((item) => (
            <CheckboxItem
              key={item.id}
              label={item.label}
              detail={item.detail}
              checked={selected.includes(item.id)}
              onToggle={() => onToggle(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckboxItem({
  label,
  detail,
  checked,
  onToggle,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{label}</div>
        {detail && (
          <div className="text-xs text-muted-foreground truncate">
            {detail}
          </div>
        )}
      </div>
    </label>
  );
}

function SelectAllButton({
  allSelected,
  onToggle,
}: {
  allSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onToggle}>
      {allSelected ? "Deselect All" : "Select All"}
    </Button>
  );
}

function ComboStep({
  title,
  description,
  items,
  selectedIds,
  combos,
  onToggleId,
  onSelectAll,
  onRemoveCombo,
  onResetCombos,
  nameMap,
}: {
  title: string;
  description: string;
  items: ContentItem[];
  selectedIds: string[];
  combos: string[][] | null;
  onToggleId: (id: string) => void;
  onSelectAll: () => void;
  onRemoveCombo: (index: number) => void;
  onResetCombos: () => void;
  nameMap: Record<string, string>;
}) {
  const effectiveCombos = combos ?? powerSet(selectedIds);
  const isCustom = combos !== null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Item selection */}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No {title.toLowerCase()} yet. You can skip this step.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} of {items.length} selected
            </span>
            <SelectAllButton
              allSelected={selectedIds.length === items.length}
              onToggle={onSelectAll}
            />
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {items.map((item) => (
              <CheckboxItem
                key={item.id}
                label={item.name ?? item.id}
                detail={item.description ?? undefined}
                checked={selectedIds.includes(item.id)}
                onToggle={() => onToggleId(item.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Combo preview */}
      {selectedIds.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Combinations ({effectiveCombos.length})
            </span>
            {isCustom && (
              <Button variant="ghost" size="sm" onClick={onResetCombos}>
                Reset to Power Set
              </Button>
            )}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {effectiveCombos.map((combo, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-muted text-sm"
              >
                <span className="truncate min-w-0">
                  {combo.length === 0 ? (
                    <span className="text-muted-foreground italic">
                      (none)
                    </span>
                  ) : (
                    combo.map((id) => nameMap[id] ?? id).join(" + ")
                  )}
                </span>
                {effectiveCombos.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onRemoveCombo(i)}
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-md bg-muted px-3 py-2 ${className ?? ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ExperimentForm, type FormState } from "@/components/experiments/experiment-form";

interface ExperimentApiData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  judgmentModes: string[];
  noiseRepeats: number;
  modelConfigIds: string[];
  dilemmaIds: string[];
  valuesSystemIds: string[];
  mentalTechniqueIds: string[];
  modifierIds: string[];
  combos: { id: string; comboType: string; itemIds: string[] }[];
}

export default function EditExperimentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initialData, setInitialData] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/experiments/${id}`);
      if (!res.ok) {
        setError("Experiment not found");
        setLoading(false);
        return;
      }
      const { data } = await res.json();
      const exp = data as ExperimentApiData;

      if (exp.status !== "draft") {
        router.replace(`/dashboard/experiments/${id}`);
        return;
      }

      const mtCombos = exp.combos
        .filter((c) => c.comboType === "mental_technique")
        .map((c) => c.itemIds);
      const modCombos = exp.combos
        .filter((c) => c.comboType === "modifier")
        .map((c) => c.itemIds);

      setInitialData({
        name: exp.name,
        description: exp.description ?? "",
        modelConfigIds: exp.modelConfigIds,
        dilemmaIds: exp.dilemmaIds,
        judgmentModes: exp.judgmentModes,
        valuesSystemIds: exp.valuesSystemIds,
        mentalTechniqueIds: exp.mentalTechniqueIds,
        modifierIds: exp.modifierIds,
        mentalTechniqueCombos: mtCombos.length > 0 ? mtCombos : null,
        modifierCombos: modCombos.length > 0 ? modCombos : null,
        noiseRepeats: exp.noiseRepeats,
      });
      setLoading(false);
    }
    load();
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">{error || "Failed to load experiment"}</p>
      </div>
    );
  }

  return (
    <ExperimentForm
      mode="edit"
      initialData={initialData}
      experimentId={id}
    />
  );
}

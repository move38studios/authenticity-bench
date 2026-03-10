"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Trash2, Pencil } from "lucide-react";

interface ModelConfig {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  temperature: number;
  topP: number | null;
  maxTokens: number;
  extraParams: Record<string, unknown> | null;
  createdAt: string;
}

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "meta", label: "Meta" },
  { value: "mistral", label: "Mistral" },
  { value: "other", label: "Other" },
];

export default function ModelsPage() {
  const [items, setItems] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ModelConfig | null>(null);

  // Form state
  const [provider, setProvider] = useState("");
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [temperature, setTemperature] = useState("1.0");
  const [topP, setTopP] = useState("");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!editingItem;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/models");
    if (res.ok) {
      const json = await res.json();
      setItems(json.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (editingItem) {
      setProvider(editingItem.provider);
      setModelId(editingItem.modelId);
      setDisplayName(editingItem.displayName);
      setTemperature(String(editingItem.temperature));
      setTopP(editingItem.topP != null ? String(editingItem.topP) : "");
      setMaxTokens(String(editingItem.maxTokens));
    } else {
      resetForm();
    }
  }, [editingItem]);

  function resetForm() {
    setProvider("");
    setModelId("");
    setDisplayName("");
    setTemperature("1.0");
    setTopP("");
    setMaxTokens("4096");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    const body: Record<string, unknown> = {
      provider,
      modelId,
      displayName,
      temperature: parseFloat(temperature),
      maxTokens: parseInt(maxTokens, 10),
    };
    if (topP) body.topP = parseFloat(topP);

    const url = isEditing ? `/api/models/${editingItem.id}` : "/api/models";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    } else {
      resetForm();
      setEditingItem(null);
      await fetchItems();
    }
    setFormLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/models/${id}`, { method: "DELETE" });
    await fetchItems();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-semibold tracking-tight">
          Model Configurations
        </h1>
        <p className="text-muted-foreground mt-1">
          LLM provider and model settings used in experiments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isEditing ? "Edit Model" : "New Model Configuration"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={provider} onValueChange={setProvider} required>
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelId">Model ID</Label>
                <Input
                  id="modelId"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="e.g. claude-sonnet-4-20250514"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Claude Sonnet 4"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topP">Top P (optional)</Label>
                <Input
                  id="topP"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={topP}
                  onChange={(e) => setTopP(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min="1"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={formLoading || !provider}>
                {formLoading
                  ? "Saving..."
                  : isEditing
                    ? "Update Model"
                    : "Create Model"}
              </Button>
              {isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Configurations</CardTitle>
          <CardDescription>
            {loading
              ? "Loading..."
              : `${items.length} ${items.length === 1 ? "model" : "models"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No models configured yet. Add one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model ID</TableHead>
                  <TableHead>Temp</TableHead>
                  <TableHead>Max Tokens</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.displayName}
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {item.provider}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.modelId}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.temperature}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.maxTokens.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

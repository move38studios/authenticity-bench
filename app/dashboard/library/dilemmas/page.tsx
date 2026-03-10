"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Trash2, Pencil, Plus, X } from "lucide-react";

interface Dilemma {
  id: string;
  title: string;
  scenario: string;
  domain: string | null;
  options: string[];
  isPublic: boolean;
  actionTool: Record<string, unknown> | null;
  inquiryTools: Record<string, unknown>[] | null;
  createdAt: string;
}

export default function DilemmasPage() {
  const [items, setItems] = useState<Dilemma[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Dilemma | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [scenario, setScenario] = useState("");
  const [domain, setDomain] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isPublic, setIsPublic] = useState(true);
  const [actionToolJson, setActionToolJson] = useState("");
  const [inquiryToolsJson, setInquiryToolsJson] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!editingItem;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/dilemmas");
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
      setTitle(editingItem.title);
      setScenario(editingItem.scenario);
      setDomain(editingItem.domain ?? "");
      setOptions(
        editingItem.options.length >= 2
          ? editingItem.options
          : [...editingItem.options, "", ""].slice(0, 2)
      );
      setIsPublic(editingItem.isPublic);
      setActionToolJson(
        editingItem.actionTool
          ? JSON.stringify(editingItem.actionTool, null, 2)
          : ""
      );
      setInquiryToolsJson(
        editingItem.inquiryTools
          ? JSON.stringify(editingItem.inquiryTools, null, 2)
          : ""
      );
    } else {
      resetForm();
    }
  }, [editingItem]);

  function resetForm() {
    setTitle("");
    setScenario("");
    setDomain("");
    setOptions(["", ""]);
    setIsPublic(true);
    setActionToolJson("");
    setInquiryToolsJson("");
    setError("");
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const filteredOptions = options.filter((o) => o.trim());
    if (filteredOptions.length < 2) {
      setError("At least 2 options are required");
      return;
    }

    // Validate JSON fields if provided
    let actionTool: Record<string, unknown> | undefined;
    let inquiryTools: Record<string, unknown>[] | undefined;

    if (actionToolJson.trim()) {
      try {
        actionTool = JSON.parse(actionToolJson);
      } catch {
        setError("Action Tool JSON is invalid");
        return;
      }
    }

    if (inquiryToolsJson.trim()) {
      try {
        inquiryTools = JSON.parse(inquiryToolsJson);
      } catch {
        setError("Inquiry Tools JSON is invalid");
        return;
      }
    }

    setFormLoading(true);

    const body: Record<string, unknown> = {
      title,
      scenario,
      options: filteredOptions,
      isPublic,
    };
    if (domain) body.domain = domain;
    if (actionTool) body.actionTool = actionTool;
    if (inquiryTools) body.inquiryTools = inquiryTools;

    const url = isEditing
      ? `/api/dilemmas/${editingItem.id}`
      : "/api/dilemmas";
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
    await fetch(`/api/dilemmas/${id}`, { method: "DELETE" });
    await fetchItems();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-semibold tracking-tight">
          Dilemmas
        </h1>
        <p className="text-muted-foreground mt-1">
          Ethical scenarios presented to models. Each dilemma has multiple
          response options.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isEditing ? "Edit Dilemma" : "New Dilemma"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Dilemma title"
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
              <Label htmlFor="scenario">Scenario (markdown)</Label>
              <Textarea
                id="scenario"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Describe the ethical dilemma..."
                rows={8}
                className="font-mono text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Response Options (minimum 2)</Label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(i)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Option
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="isPublic" className="text-sm font-normal">
                Public (visible to all users)
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actionTool">Action Tool JSON (optional)</Label>
                <Textarea
                  id="actionTool"
                  value={actionToolJson}
                  onChange={(e) => setActionToolJson(e.target.value)}
                  placeholder='{"name": "decide", "parameters": {...}}'
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inquiryTools">
                  Inquiry Tools JSON (optional)
                </Label>
                <Textarea
                  id="inquiryTools"
                  value={inquiryToolsJson}
                  onChange={(e) => setInquiryToolsJson(e.target.value)}
                  placeholder='[{"name": "ask_expert", "parameters": {...}}]'
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={formLoading}>
                {formLoading
                  ? "Saving..."
                  : isEditing
                    ? "Update Dilemma"
                    : "Create Dilemma"}
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
          <CardTitle>Dilemmas</CardTitle>
          <CardDescription>
            {loading
              ? "Loading..."
              : `${items.length} ${items.length === 1 ? "dilemma" : "dilemmas"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No dilemmas yet. Create one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>
                      {item.domain ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {item.domain}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {item.options.length} options
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs ${item.isPublic ? "text-green-600" : "text-muted-foreground"}`}
                      >
                        {item.isPublic ? "Public" : "Private"}
                      </span>
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

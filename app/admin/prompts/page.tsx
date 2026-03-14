"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Save, X, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface SystemPrompt {
  id: string;
  slug: string;
  name: string;
  content: string;
  description: string | null;
  category: string;
  variables: string | null;
  createdAt: string;
  updatedAt: string;
}

const categoryColors: Record<string, string> = {
  judgment: "bg-blue-100 text-blue-800",
  generation: "bg-purple-100 text-purple-800",
  analysis: "bg-green-100 text-green-800",
  utility: "bg-amber-100 text-amber-800",
};

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPrompts();
  }, []);

  async function fetchPrompts() {
    try {
      const res = await fetch("/api/admin/prompts");
      if (res.ok) {
        const json = await res.json();
        setPrompts(json.data);
      }
    } finally {
      setLoading(false);
    }
  }

  function startEditing(prompt: SystemPrompt) {
    setEditingSlug(prompt.slug);
    setEditContent(prompt.content);
    setEditName(prompt.name);
    setEditDescription(prompt.description ?? "");
  }

  function cancelEditing() {
    setEditingSlug(null);
    setEditContent("");
    setEditName("");
    setEditDescription("");
  }

  async function saveEdit() {
    if (!editingSlug) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prompts/${editingSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          content: editContent,
          description: editDescription || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Prompt updated");
        cancelEditing();
        fetchPrompts();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // Group by category
  const grouped = prompts.reduce<Record<string, SystemPrompt[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const categoryOrder = ["judgment", "generation", "analysis", "utility"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">System Prompts</h1>
        <p className="text-muted-foreground mt-1">
          Manage all system prompts used across the platform. Changes take effect within 5 minutes (or immediately on save).
        </p>
      </div>

      {categoryOrder
        .filter((cat) => grouped[cat]?.length)
        .map((category) => {
          const items = grouped[category];
          const isCollapsed = collapsedCategories.has(category);

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <h2 className="text-lg font-semibold capitalize">{category}</h2>
                <Badge variant="secondary" className={categoryColors[category]}>
                  {items.length}
                </Badge>
              </button>

              {!isCollapsed && (
                <div className="space-y-3">
                  {items.map((prompt) => (
                    <Card key={prompt.slug}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="space-y-0.5">
                            {editingSlug === prompt.slug ? (
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="font-semibold h-8"
                              />
                            ) : (
                              <span>{prompt.name}</span>
                            )}
                            <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {prompt.slug}
                              </code>
                              {prompt.variables && (
                                <span className="text-xs">
                                  vars: {prompt.variables}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {editingSlug === prompt.slug ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditing}
                                  disabled={saving}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={saveEdit}
                                  disabled={saving}
                                >
                                  {saving ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Save className="h-3 w-3 mr-1" />
                                  )}
                                  Save
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditing(prompt)}
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {editingSlug === prompt.slug ? (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Description</Label>
                              <Input
                                value={editDescription}
                                onChange={(e) =>
                                  setEditDescription(e.target.value)
                                }
                                placeholder="What this prompt does"
                                className="h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Content</Label>
                              <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={Math.min(
                                  20,
                                  Math.max(6, editContent.split("\n").length + 2)
                                )}
                                className="font-mono text-xs"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {prompt.description && (
                              <p className="text-sm text-muted-foreground">
                                {prompt.description}
                              </p>
                            )}
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto whitespace-pre-wrap max-h-[200px]">
                              {prompt.content}
                            </pre>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

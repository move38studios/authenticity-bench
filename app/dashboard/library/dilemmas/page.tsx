"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Pencil, Plus, X, Search } from "lucide-react";
import { GenerateDialog } from "@/components/generate-dialog";
import Link from "next/link";

interface DilemmaOption {
  slug: string;
  label: string;
  description: string;
  actionTool: { name: string; description: string } | null;
}

interface Dilemma {
  id: string;
  title: string;
  scenario: string;
  domain: string | null;
  tags: string[];
  options: DilemmaOption[];
  isPublic: boolean;
  inquiryTools: Record<string, unknown>[] | null;
  createdAt: string;
}

interface OptionFormState {
  slug: string;
  label: string;
  description: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export default function DilemmasPage() {
  const [items, setItems] = useState<Dilemma[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create form state
  const [title, setTitle] = useState("");
  const [scenario, setScenario] = useState("");
  const [domain, setDomain] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [options, setOptions] = useState<OptionFormState[]>([
    { slug: "", label: "", description: "" },
    { slug: "", label: "", description: "" },
  ]);
  const [isPublic, setIsPublic] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

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

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const lc = search.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(lc) ||
        (item.domain ?? "").toLowerCase().includes(lc) ||
        (item.tags ?? []).some((t) => t.toLowerCase().includes(lc))
    );
  }, [items, search]);

  function resetForm() {
    setTitle("");
    setScenario("");
    setDomain("");
    setTagsInput("");
    setOptions([
      { slug: "", label: "", description: "" },
      { slug: "", label: "", description: "" },
    ]);
    setIsPublic(true);
    setError("");
  }

  function updateOption(index: number, field: keyof OptionFormState, value: string) {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (i !== index) return o;
        const updated = { ...o, [field]: value };
        // Auto-generate slug from label
        if (field === "label" && !o.slug) {
          updated.slug = slugify(value);
        }
        return updated;
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const filteredOptions = options.filter((o) => o.label.trim());
    if (filteredOptions.length < 2) {
      setError("At least 2 options are required");
      return;
    }

    // Ensure all options have slugs
    const optionsWithSlugs = filteredOptions.map((o) => ({
      slug: o.slug || slugify(o.label),
      label: o.label.trim(),
      description: o.description.trim() || o.label.trim(),
      actionTool: null,
    }));

    // Check slug uniqueness
    const slugs = optionsWithSlugs.map((o) => o.slug);
    if (new Set(slugs).size !== slugs.length) {
      setError("Each option must have a unique slug");
      return;
    }

    setFormLoading(true);

    const body: Record<string, unknown> = {
      title,
      scenario,
      options: optionsWithSlugs,
      isPublic,
    };
    if (domain) body.domain = domain;
    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (parsedTags.length > 0) body.tags = parsedTags;

    const res = await fetch("/api/dilemmas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    } else {
      resetForm();
      await fetchItems();
    }
    setFormLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 sm:space-y-0 sm:flex sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Dilemmas
          </h1>
          <p className="text-muted-foreground mt-1">
            Ethical scenarios presented to models. Each dilemma has multiple
            response options.
          </p>
        </div>
        <GenerateDialog
          entityType="dilemma"
          entityLabel="Dilemmas"
          createApiPath="/api/dilemmas"
          onGenerated={fetchItems}
          mapToCreateBody={(item) => ({
            title: item.title,
            scenario: item.scenario,
            domain: item.domain,
            tags: item.tags,
            options: item.options,
            isPublic: true,
          })}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Dilemma</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label htmlFor="tags">Tags (optional, comma-separated)</Label>
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
                placeholder="Describe the ethical dilemma..."
                rows={8}
                className="font-mono text-sm"
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Response Options (minimum 2)</Label>
              <div className="space-y-3">
                {options.map((opt, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">
                        Option {i + 1}
                      </span>
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
                        placeholder="Slug (auto-generated)"
                        className="font-mono text-sm"
                      />
                    </div>
                    <Input
                      value={opt.description}
                      onChange={(e) => updateOption(i, "description", e.target.value)}
                      placeholder="Description (optional, defaults to label)"
                    />
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
                    { slug: "", label: "", description: "" },
                  ])
                }
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

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={formLoading}>
              {formLoading ? "Saving..." : "Create Dilemma"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dilemmas</CardTitle>
          <CardDescription>
            {loading
              ? "Loading..."
              : filteredItems.length === items.length
                ? `${items.length} ${items.length === 1 ? "dilemma" : "dilemmas"}`
                : `${filteredItems.length} of ${items.length} dilemmas`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, domain, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {filteredItems.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? "No dilemmas yet. Create one above."
                : "No dilemmas match your search."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead>Inquiry Tools</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const hasActionTools = Array.isArray(item.options) &&
                    item.options.every((o) => o.actionTool != null);
                  const hasInquiryTools = Array.isArray(item.inquiryTools) &&
                    item.inquiryTools.length > 0;
                  return (
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
                        {item.tags && item.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-muted px-1.5 py-0.5 text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                            {item.tags.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{item.tags.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.options.map((o) => (
                            <span
                              key={o.slug}
                              className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono"
                            >
                              {o.slug}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs ${hasInquiryTools ? "text-green-600" : "text-muted-foreground"}`}
                        >
                          {hasInquiryTools
                            ? `${item.inquiryTools!.length} tools`
                            : hasActionTools
                              ? "Actions only"
                              : "None"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/library/dilemmas/${item.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
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
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

interface ContentDetailPageProps {
  id: string;
  entityName: string;
  apiPath: string;
  backPath: string;
  /** Render additional fields below description. Gets current item + setter. */
  renderExtraFields?: (props: {
    item: Record<string, unknown>;
    update: (patch: Record<string, unknown>) => void;
  }) => React.ReactNode;
  /** Map the fetched item to form fields for extra fields */
  extraFieldsFromItem?: (item: Record<string, unknown>) => Record<string, unknown>;
  /** Map extra fields to the API body */
  extraFieldsToBody?: (extra: Record<string, unknown>) => Record<string, unknown>;
}

export function ContentDetailPage({
  id,
  entityName,
  apiPath,
  backPath,
  renderExtraFields,
  extraFieldsFromItem,
  extraFieldsToBody,
}: ContentDetailPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [extraFields, setExtraFields] = useState<Record<string, unknown>>({});

  const fetchItem = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${apiPath}/${id}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const json = await res.json();
    const item = json.data;
    setName(item.name ?? item.title ?? "");
    setContent(item.content ?? item.scenario ?? "");
    setDescription(item.description ?? "");
    if (extraFieldsFromItem) {
      setExtraFields(extraFieldsFromItem(item));
    }
    setLoading(false);
  }, [id, apiPath, extraFieldsFromItem]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body: Record<string, unknown> = {
      name,
      content,
      description: description || undefined,
    };

    if (extraFieldsToBody) {
      Object.assign(body, extraFieldsToBody(extraFields));
    }

    const res = await fetch(`${apiPath}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    } else {
      router.push(backPath);
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`${apiPath}/${id}`, { method: "DELETE" });
    router.push(backPath);
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
        <p className="text-muted-foreground">{entityName} not found.</p>
        <Button variant="outline" asChild>
          <Link href={backPath}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backPath}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight truncate">
          {name || entityName}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit {entityName}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary for display"
              />
            </div>

            {renderExtraFields &&
              renderExtraFields({
                item: extraFields,
                update: (patch) =>
                  setExtraFields((prev) => ({ ...prev, ...patch })),
              })}

            <div className="space-y-2">
              <Label htmlFor="content">Content (markdown)</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                className="font-mono text-sm"
                required
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
                    `Save ${entityName}`
                  )}
                </Button>
                <Button type="button" variant="ghost" asChild>
                  <Link href={backPath}>Cancel</Link>
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
                    <AlertDialogTitle>Delete {entityName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &quot;{name}&quot;. This
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
    </div>
  );
}

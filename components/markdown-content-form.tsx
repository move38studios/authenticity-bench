"use client";

import { useState, useEffect } from "react";
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

interface MarkdownContentFormProps {
  apiPath: string;
  entityName: string;
  onCreated: () => void;
  editingItem: { id: string; name: string; content: string; description?: string | null } | null;
  onCancelEdit: () => void;
}

export function MarkdownContentForm({
  apiPath,
  entityName,
  onCreated,
  editingItem,
  onCancelEdit,
}: MarkdownContentFormProps) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!editingItem;

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setContent(editingItem.content);
      setDescription(editingItem.description ?? "");
    } else {
      setName("");
      setContent("");
      setDescription("");
    }
  }, [editingItem]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = { name, content, description: description || undefined };
    const url = isEditing ? `${apiPath}/${editingItem.id}` : apiPath;
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
      setName("");
      setContent("");
      setDescription("");
      onCreated();
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? `Edit ${entityName}` : `New ${entityName}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${entityName} name`}
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
          <div className="space-y-2">
            <Label htmlFor="content">Content (markdown)</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`${entityName} content in markdown...`}
              rows={12}
              className="font-mono text-sm"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading
                ? "Saving..."
                : isEditing
                  ? `Update ${entityName}`
                  : `Create ${entityName}`}
            </Button>
            {isEditing && (
              <Button type="button" variant="ghost" onClick={onCancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

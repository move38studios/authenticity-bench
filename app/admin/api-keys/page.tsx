"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Trash2, Eye, EyeOff, Power, PowerOff } from "lucide-react";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "openrouter", label: "OpenRouter" },
] as const;

interface ApiKeyEntry {
  id: string;
  provider: string;
  label: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ApiKeysPage() {
  const [entries, setEntries] = useState<ApiKeyEntry[]>([]);
  const [provider, setProvider] = useState("");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);

  async function fetchEntries() {
    const res = await fetch("/api/admin/api-keys");
    if (res.ok) {
      setEntries(await res.json());
    }
  }

  useEffect(() => {
    fetchEntries();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!provider || !apiKey.trim()) return;
    setLoading(true);

    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        label: label.trim() || undefined,
        apiKey: apiKey.trim(),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Failed to add key");
    } else {
      toast.success("API key added");
      setProvider("");
      setLabel("");
      setApiKey("");
      setShowKey(false);
      await fetchEntries();
    }
    setLoading(false);
  }

  async function toggleActive(entry: ApiKeyEntry) {
    const res = await fetch("/api/admin/api-keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, isActive: !entry.isActive }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Failed to update key");
    } else {
      toast.success(
        entry.isActive ? "Key deactivated" : "Key activated"
      );
      await fetchEntries();
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/api-keys?id=${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Failed to delete key");
    } else {
      toast.success("API key deleted");
      await fetchEntries();
    }
  }

  const providerLabel = (p: string) =>
    PROVIDERS.find((pr) => pr.value === p)?.label ?? p;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          API Keys
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage LLM provider API keys. Keys are encrypted at rest.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add API Key</CardTitle>
          <CardDescription>
            Store a new provider key in the database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
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
                <Label htmlFor="label">Label (optional)</Label>
                <Input
                  id="label"
                  placeholder="e.g. Production key"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="apiKey"
                    type={showKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10 font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button type="submit" disabled={loading || !provider || !apiKey}>
                  Add Key
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stored Keys</CardTitle>
          <CardDescription>
            {entries.length} {entries.length === 1 ? "key" : "keys"} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No API keys stored yet. Add at least one key per provider you
              want to use.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {providerLabel(entry.provider)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{entry.label}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {entry.maskedKey}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={entry.isActive ? "default" : "outline"}
                        className={
                          entry.isActive
                            ? "bg-green-600 hover:bg-green-700"
                            : ""
                        }
                      >
                        {entry.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(entry)}
                          title={entry.isActive ? "Deactivate" : "Activate"}
                        >
                          {entry.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete API key?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the{" "}
                                {providerLabel(entry.provider)} key &ldquo;
                                {entry.label}&rdquo;. Any features using this
                                provider will stop working until a new key is
                                added.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => remove(entry.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

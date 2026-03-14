"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { Plus, Trash2, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Experiment {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalJudgments: number | null;
  completedCount: number;
  failedCount: number;
  previewToken: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default function ExperimentsPage() {
  const [items, setItems] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/experiments");
    if (res.ok) {
      const json = await res.json();
      setItems(json.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleDelete(id: string) {
    await fetch(`/api/experiments/${id}`, { method: "DELETE" });
    await fetchItems();
  }

  async function handlePreview(item: Experiment) {
    if (item.previewToken) {
      window.open(`/preview/${item.previewToken}`, "_blank");
      return;
    }
    setPreviewingId(item.id);
    try {
      const res = await fetch(`/api/experiments/${item.id}/preview-token`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Failed to generate preview link");
        return;
      }
      const { data } = await res.json();
      window.open(`/preview/${data.previewToken}`, "_blank");
      await fetchItems();
    } catch {
      toast.error("Failed to generate preview link");
    } finally {
      setPreviewingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Experiments
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure and run benchmark experiments across models.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/experiments/new">
            <Plus className="h-4 w-4 mr-2" />
            New Experiment
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Experiments</CardTitle>
          <CardDescription>
            {loading
              ? "Loading..."
              : `${items.length} ${items.length === 1 ? "experiment" : "experiments"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No experiments yet. Create one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Judgments</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Progress</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/experiments/${item.id}`}
                          className="font-medium hover:underline"
                        >
                          <span className="line-clamp-1">{item.name}</span>
                        </Link>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[item.status] ?? ""}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.totalJudgments?.toLocaleString() ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                        {item.status !== "draft"
                          ? `${item.completedCount}/${item.totalJudgments ?? 0}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(item)}
                          disabled={previewingId === item.id}
                          title="Preview"
                        >
                          {previewingId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {item.status === "draft" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Experiment?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete &quot;{item.name}&quot; and all its configuration. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(item.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

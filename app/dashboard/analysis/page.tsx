"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, MessageSquare, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface AnalysisChat {
  id: string;
  title: string | null;
  loadedExperiments: Array<{ name: string; experimentId: string }>;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function AnalysisListPage() {
  const router = useRouter();
  const [chats, setChats] = useState<AnalysisChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnalysisChat | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  async function fetchChats() {
    const res = await fetch("/api/analysis/chat");
    if (res.ok) {
      const json = await res.json();
      setChats(json.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  async function handleNewChat() {
    setCreating(true);
    try {
      const res = await fetch("/api/analysis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const json = await res.json();
        router.push(`/dashboard/analysis/${json.data.id}`);
      } else {
        toast.error("Failed to create chat");
      }
    } catch {
      toast.error("Failed to create chat");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/analysis/chat/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setChats((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Chat deleted");
    } else {
      toast.error("Failed to delete chat");
    }
    setDeleteTarget(null);
  }

  function startRename(chat: AnalysisChat, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title || "");
  }

  async function saveRename(chatId: string) {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    const res = await fetch(`/api/analysis/chat/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (res.ok) {
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title: trimmed } : c))
      );
    } else {
      toast.error("Failed to rename");
    }
    setEditingId(null);
  }

  function cancelRename() {
    setEditingId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered analysis of experiment data. Load experiments, run queries, and generate visualizations.
          </p>
        </div>
        <Button onClick={handleNewChat} disabled={creating} className="w-full sm:w-auto">
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          New Chat
        </Button>
      </div>

      {chats.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No analysis chats yet. Start a new chat to explore your experiment data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/dashboard/analysis/${chat.id}`}
              className="block"
              onClick={(e) => {
                if (editingId === chat.id) e.preventDefault();
              }}
            >
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {editingId === chat.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRename(chat.id);
                              if (e.key === "Escape") cancelRename();
                            }}
                            className="text-sm font-medium bg-transparent border-b border-foreground/30 outline-none px-0 py-0 w-48"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => saveRename(chat.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={cancelRename}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="font-medium text-sm truncate">
                          {chat.title || "Untitled chat"}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {chat.messageCount} messages
                      </span>
                    </div>
                    {chat.loadedExperiments.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {chat.loadedExperiments.map((exp) => (
                          <Badge
                            key={exp.experimentId}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {exp.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <span className="text-xs text-muted-foreground mr-2">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => startRename(chat, e)}
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteTarget(chat);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.title || "Untitled chat"}&rdquo; and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

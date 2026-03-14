"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { Loader2, Copy as CopyIcon, Check, Download } from "lucide-react";
import { toast } from "sonner";

interface SharedChat {
  chat: {
    id: string;
    title: string | null;
    loadedExperiments: Array<{ name: string; experimentId: string }>;
    createdAt: string;
    owner: { name: string };
  };
  messages: Array<{
    id: string;
    role: string;
    parts: Array<{ type: string; [key: string]: unknown }>;
    createdAt: string;
  }>;
  viewer: {
    isAuthenticated: boolean;
    isOwner: boolean;
    canClone: boolean;
  };
}

export default function SharedAnalysisChatPage() {
  const { sharingUuid } = useParams<{ sharingUuid: string }>();
  const router = useRouter();
  const [data, setData] = useState<SharedChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/share/analysis/${sharingUuid}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sharingUuid]);

  const handleClone = async () => {
    setCloning(true);
    try {
      const res = await fetch("/api/analysis/chat/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharingUuid }),
      });
      if (!res.ok) throw new Error("Clone failed");
      const json = await res.json();
      router.push(`/dashboard/analysis/${json.data.chatId}`);
    } catch {
      toast.error("Failed to clone chat");
    } finally {
      setCloning(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${data.chat.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Chat not found or sharing is disabled.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-semibold">
          {data.chat.title || "Shared Analysis"}
        </h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>by {data.chat.owner.name}</span>
          <span>&middot;</span>
          <span>{new Date(data.chat.createdAt).toLocaleDateString()}</span>
        </div>
        {data.chat.loadedExperiments?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {data.chat.loadedExperiments.map((exp) => (
              <Badge key={exp.experimentId} variant="secondary" className="text-[10px] px-1.5 py-0">
                {exp.name}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <CopyIcon className="h-3.5 w-3.5 mr-1.5" />}
            Copy link
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJson}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export JSON
          </Button>
          {data.viewer.canClone && (
            <Button size="sm" onClick={handleClone} disabled={cloning}>
              {cloning && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Clone to my chats
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {data.messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                  isUser ? "bg-muted" : "bg-card border"
                }`}
              >
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return isUser ? (
                      <div key={i} className="whitespace-pre-wrap break-words">
                        {part.text as string}
                      </div>
                    ) : (
                      <div key={i} className="break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <Markdown>{part.text as string}</Markdown>
                      </div>
                    );
                  }
                  // Tool parts: old format "tool-invocation" or new format "tool-{name}"
                  if (part.type === "tool-invocation" || (part.type.startsWith("tool-") && part.type !== "text")) {
                    const toolName = part.type === "tool-invocation"
                      ? (part.toolName as string)
                      : part.type.slice(5);
                    const output = (part.output ?? part.result) as Record<string, unknown> | undefined;
                    const files = (output?.files as Array<{ url: string; fileName: string; contentType: string }>) ?? [];
                    const imageFiles = files.filter((f) => f.contentType?.startsWith("image/"));
                    return (
                      <div key={i} className="my-1">
                        <div className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">
                          {toolName}: completed
                        </div>
                        {imageFiles.map((file) => (
                          <img
                            key={file.url}
                            src={file.url}
                            alt={file.fileName}
                            className="max-w-full rounded-md border mt-2"
                          />
                        ))}
                      </div>
                    );
                  }
                  if (part.type === "step-start") return null;
                  return null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

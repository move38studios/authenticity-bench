"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Send,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  XCircle,
  Share2,
  Pencil,
  Check,
  X,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ShareChatDialog } from "@/components/analysis/share-chat-dialog";

// =============================================================================
// TYPES
// =============================================================================

interface ChatData {
  id: string;
  title: string | null;
  loadedExperiments: Array<{ name: string; experimentId: string }>;
  sharingEnabled: boolean;
}

interface LoadedChat {
  chat: ChatData;
  messages: Array<{
    id: string;
    role: string;
    parts: unknown[];
    createdAt: string;
  }>;
}

interface ModelOption {
  id: string;
  modelId: string;
  provider: string;
  displayName: string;
}

type InitialMessage = { id: string; role: "user" | "assistant"; parts: unknown[]; createdAt: Date };

const DEFAULT_MODEL_ID = "google/gemini-3.1-flash-lite-preview";

// =============================================================================
// MAIN COMPONENT (loader)
// =============================================================================

export default function AnalysisChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const router = useRouter();
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [initialMessages, setInitialMessages] = useState<InitialMessage[] | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODEL_ID);

  useEffect(() => {
    async function load() {
      const [chatRes, modelsRes] = await Promise.all([
        fetch(`/api/analysis/chat/${chatId}`),
        fetch("/api/models"),
      ]);
      if (!chatRes.ok) {
        router.push("/dashboard/analysis");
        return;
      }
      const json = await chatRes.json();
      const data = json.data as LoadedChat;
      setChatData(data.chat);
      setInitialMessages(
        data.messages.map((m) => {
          let parts = m.parts;
          if (typeof parts === "string") {
            try { parts = JSON.parse(parts); } catch { /* keep as-is */ }
          }
          return {
            id: m.id,
            role: m.role as "user" | "assistant",
            parts: parts as unknown[],
            createdAt: new Date(m.createdAt),
          };
        })
      );

      if (modelsRes.ok) {
        const modelsJson = await modelsRes.json();
        const items = modelsJson.data as Array<{ id: string; provider: string; modelId: string; displayName: string }>;
        setModels(items.map((m) => ({
          id: m.id,
          modelId: m.modelId,
          provider: m.provider,
          displayName: m.displayName,
        })));
        // Build full provider/modelId for matching
        const fullId = (m: { provider: string; modelId: string }) =>
          m.modelId.includes("/") ? m.modelId : `${m.provider}/${m.modelId}`;
        const match = items.find((m) => fullId(m) === DEFAULT_MODEL_ID);
        setDefaultModel(match ? fullId(match) : (items[0] ? fullId(items[0]) : DEFAULT_MODEL_ID));
      }
    }
    load();
  }, [chatId, router]);

  if (!chatData || initialMessages === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ChatUI
      chatId={chatId}
      chatData={chatData}
      initialMessages={initialMessages}
      models={models}
      defaultModel={defaultModel}
    />
  );
}

// =============================================================================
// CHAT UI (mounts only after data is loaded, so useChat gets correct initial messages)
// =============================================================================

function ChatUI({
  chatId,
  chatData,
  initialMessages,
  models,
  defaultModel,
}: {
  chatId: string;
  chatData: ChatData;
  initialMessages: InitialMessage[];
  models: ModelOption[];
  defaultModel: string;
}) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [title, setTitle] = useState(chatData.title || "");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing]);

  const startRename = () => {
    setEditTitle(title || "");
    setEditing(true);
  };

  const saveRename = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed) { setEditing(false); return; }
    const res = await fetch(`/api/analysis/chat/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (res.ok) {
      setTitle(trimmed);
    } else {
      toast.error("Failed to rename");
    }
    setEditing(false);
  };

  const exportJson = () => {
    const data = {
      chatId,
      title: title || "Untitled",
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${chatId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/analysis/chat/${chatId}/messages`,
        headers: () => ({
          "x-model-id": selectedModelRef.current,
        }),
      }),
    [chatId]
  );

  const {
    messages,
    sendMessage,
    status,
    error: chatError,
  } = useChat({
    transport,
    id: chatId,
    messages: initialMessages.length > 0 ? initialMessages as never : undefined,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // After first assistant response, poll for auto-generated title
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "streaming" && status === "ready" && !title) {
      // Server generates title in onFinish — give it a moment then fetch
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/analysis/chat/${chatId}`);
          if (res.ok) {
            const json = await res.json();
            const newTitle = json.data?.chat?.title;
            if (newTitle) setTitle(newTitle);
          }
        } catch { /* ignore */ }
      }, 2000);
      return () => clearTimeout(timer);
    }
    prevStatus.current = status;
  }, [status, title, chatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    sendMessage({ text });
  }, [input, isLoading, sendMessage]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/dashboard/analysis">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {editing ? (
              <>
                <input
                  ref={editRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="text-base sm:text-lg font-semibold bg-transparent border-b border-foreground/30 outline-none px-0 py-0 w-full max-w-64"
                />
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveRename}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <h1 className="text-base sm:text-lg font-semibold truncate">
                  {title || "New Analysis"}
                </h1>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={startRename}>
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exportJson} title="Export JSON">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShareOpen(true)} title="Share">
            <Share2 className="h-4 w-4" />
          </Button>
          {/* Mobile: cog opens dialog. Desktop: inline picker */}
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" onClick={() => setSettingsOpen(true)} title="Settings">
            <Settings className="h-4 w-4" />
          </Button>
          {models.length > 0 && (
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[200px] h-8 text-xs hidden sm:flex">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => {
                  const fullId = m.modelId.includes("/") ? m.modelId : `${m.provider}/${m.modelId}`;
                  return (
                    <SelectItem key={m.id} value={fullId} className="text-xs">
                      {m.displayName}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <ShareChatDialog chatId={chatId} open={shareOpen} onOpenChange={setShareOpen} />

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Chat Settings</DialogTitle>
          </DialogHeader>
          {models.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => {
                    const fullId = m.modelId.includes("/") ? m.modelId : `${m.provider}/${m.modelId}`;
                    return (
                      <SelectItem key={m.id} value={fullId} className="text-sm">
                        {m.displayName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <EmptyState onSelect={setInput} />
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}

        {chatError && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
            Error: {chatError.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-4 border-t shrink-0">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about experiment data..."
          rows={2}
          className="resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          disabled={isLoading || !input.trim()}
          className="shrink-0 self-end"
          onClick={handleSend}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  const suggestions = [
    "List all available experiments",
    "What are the overall completion and refusal rates by model?",
    "How consistent are choices across noise repeats?",
    "Compare theory vs action mode choices for each model",
  ];

  return (
    <div className="text-center py-12 space-y-4">
      <p className="text-sm text-muted-foreground">
        Start by loading an experiment, then ask questions about the data.
      </p>
      <div className="space-y-1.5 max-w-sm mx-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            className="block w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded hover:bg-muted"
            onClick={() => onSelect(s)}
          >
            &ldquo;{s}&rdquo;
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: { role: string; parts: unknown[] } }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
          isUser ? "bg-muted" : "bg-card border"
        }`}
      >
        {(message.parts as Array<{ type: string; [key: string]: unknown }>).map(
          (part, i) => {
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
            if (part.type === "reasoning") {
              return (
                <div key={i} className="text-xs text-muted-foreground italic mb-1">
                  {(part.text as string).slice(0, 200)}...
                </div>
              );
            }
            // Tool parts: streaming uses "tool-{name}" type, persisted uses "tool-invocation"
            if (part.type === "tool-invocation" || (part.type.startsWith("tool-") && part.type !== "tool-invocation")) {
              const toolName = part.type === "tool-invocation"
                ? (part.toolName as string)
                : part.type.slice(5); // "tool-list_experiments" → "list_experiments"
              const state = (part.state as string) ?? "call";
              return (
                <ToolCallDisplay
                  key={i}
                  toolName={toolName}
                  args={(part.args ?? part.input ?? {}) as Record<string, unknown>}
                  result={state === "result" || state === "output-available"
                    ? ((part.result ?? part.output ?? {}) as Record<string, unknown>)
                    : undefined}
                  state={state}
                />
              );
            }
            return null;
          }
        )}
      </div>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  list_experiments: "Listing experiments",
  load_experiment: "Loading experiment",
  execute_python: "Running Python",
  viewimage: "Viewing image",
};

function ToolCallDisplay({
  toolName,
  args,
  result,
  state,
}: {
  toolName: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  state: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = state === "call" || state === "partial-call" || state === "input-streaming" || state === "input-available";
  const success = result && (result.success !== false && result.exitCode !== 1);
  const files = (result?.files as Array<{ fileName: string; url: string; contentType: string; size: number }>) ?? [];
  const imageFiles = files.filter((f) => f.contentType?.startsWith("image/"));
  const otherFiles = files.filter((f) => !f.contentType?.startsWith("image/"));
  const label = (toolName && TOOL_LABELS[toolName]) || toolName || "Working";

  return (
    <div className="my-2 border rounded-md overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        {isRunning ? (
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        ) : success ? (
          <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
        ) : (
          <XCircle className="h-3 w-3 text-red-600 shrink-0" />
        )}
        <span className="font-mono">
          {isRunning ? `${label}...` : toolName}
        </span>
        {!isRunning && (
          expanded ? (
            <ChevronDown className="h-3 w-3 ml-auto shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 ml-auto shrink-0" />
          )
        )}
      </button>

      {expanded && !isRunning && (
        <div className="p-3 space-y-2">
          {typeof args.code === "string" && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Code
              </div>
              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
                {args.code}
              </pre>
            </div>
          )}
          {typeof args.experimentId === "string" && (
            <div className="text-xs text-muted-foreground">
              Experiment: {args.experimentId}
            </div>
          )}
          {typeof args.url === "string" && (
            <div className="text-xs text-muted-foreground truncate">
              URL: {args.url}
            </div>
          )}
          {typeof result?.stdout === "string" && result.stdout && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Output
              </div>
              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
                {result.stdout}
              </pre>
            </div>
          )}
          {typeof result?.stderr === "string" && result.stderr && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-red-600 mb-1">
                Stderr
              </div>
              <pre className="bg-red-50 dark:bg-red-950/30 p-2 rounded text-xs overflow-auto max-h-[100px] whitespace-pre-wrap">
                {result.stderr}
              </pre>
            </div>
          )}
          {typeof result?.error === "string" && result.error && (
            <div className="text-xs text-destructive">
              {result.error}
            </div>
          )}
          {typeof result?.message === "string" && (
            <div className="text-xs text-muted-foreground">
              {result.message}
            </div>
          )}
          {/* Generic result display for tools without specific rendering */}
          {result && !result.stdout && !result.stderr && !result.error && !result.message && (
            <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Show images inline (even when collapsed) */}
      {imageFiles.length > 0 && (
        <div className="px-3 pb-2 space-y-2">
          {imageFiles.map((file) => (
            <div key={file.url}>
              <img
                src={file.url}
                alt={file.fileName}
                className="max-w-full rounded-md border"
              />
            </div>
          ))}
        </div>
      )}

      {/* Download cards for non-image files */}
      {otherFiles.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {otherFiles.map((file) => (
            <a
              key={file.url}
              href={file.url}
              download={file.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
            >
              {file.contentType?.includes("csv") || file.contentType?.includes("spreadsheet") ? (
                <FileText className="h-3.5 w-3.5 text-green-600 shrink-0" />
              ) : file.contentType?.startsWith("image/") ? (
                <ImageIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              ) : (
                <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-mono truncate">{file.fileName}</span>
              <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                {file.size > 1024 * 1024
                  ? `${(file.size / 1024 / 1024).toFixed(1)}MB`
                  : `${(file.size / 1024).toFixed(1)}KB`}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

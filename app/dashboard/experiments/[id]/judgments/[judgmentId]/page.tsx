"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface ConversationMessage {
  role: string;
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  toolResults?: Array<{ id: string; name: string; result: string }>;
}

interface JudgmentDetail {
  id: string;
  experimentId: string;
  status: string;
  dilemmaId: string;
  modelConfigId: string;
  valuesSystemId: string | null;
  mentalTechniqueIds: string[];
  modifierIds: string[];
  judgmentMode: string;
  noiseIndex: number;
  systemPrompt: string | null;
  userPrompt: string | null;
  refusalType: string | null;
  choice: string | null;
  reasoning: string | null;
  confidence: number | null;
  conversationLog: ConversationMessage[] | null;
  rawResponse: unknown;
  inquiryToolCalls: unknown;
  errorMessage: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  costEstimate: number | null;
  createdAt: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function JudgmentDetailPage() {
  const { id, judgmentId } = useParams<{ id: string; judgmentId: string }>();
  const [data, setData] = useState<JudgmentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/experiments/${id}/judgments/${judgmentId}`)
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, [id, judgmentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground text-center py-20">Judgment not found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/dashboard/experiments/${id}/judgments`}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Judgments
        </Link>
      </Button>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Status" value={data.status} />
        <Stat label="Mode" value={data.judgmentMode} />
        <Stat label="Choice" value={data.choice ?? "—"} />
        <Stat label="Confidence" value={data.confidence != null ? data.confidence.toFixed(2) : "—"} />
        <Stat label="Refusal" value={data.refusalType ?? "—"} />
        <Stat label="Noise Index" value={data.noiseIndex.toString()} />
        <Stat label="Latency" value={data.latencyMs != null ? `${(data.latencyMs / 1000).toFixed(1)}s` : "—"} />
        <Stat label="Cost" value={data.costEstimate != null ? `$${data.costEstimate.toFixed(4)}` : "—"} />
      </div>

      {/* Token usage */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Prompt Tokens" value={(data.promptTokens ?? 0).toLocaleString()} />
        <Stat label="Completion Tokens" value={(data.completionTokens ?? 0).toLocaleString()} />
        <Stat label="Reasoning Tokens" value={(data.reasoningTokens ?? 0).toLocaleString()} />
      </div>

      {/* Reasoning */}
      {data.reasoning && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{data.reasoning}</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {data.errorMessage && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono text-destructive">{data.errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Conversation log */}
      {data.conversationLog && data.conversationLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Conversation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.conversationLog.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* System prompt (collapsible) */}
      {data.systemPrompt && (
        <CollapsiblePrompt title="System Prompt" content={data.systemPrompt} />
      )}

      {/* User prompt (collapsible) */}
      {data.userPrompt && (
        <CollapsiblePrompt title="User Prompt" content={data.userPrompt} />
      )}

      {/* Raw response (collapsible) */}
      {data.rawResponse != null && (
        <CollapsiblePrompt
          title="Raw Response"
          content={JSON.stringify(data.rawResponse, null, 2)}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-mono truncate" title={value}>{value}</div>
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const roleColors: Record<string, string> = {
    system: "bg-muted border-muted",
    user: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
    assistant: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    tool: "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800",
  };

  return (
    <div className={`rounded-md border p-3 ${roleColors[message.role] ?? "bg-muted"}`}>
      <Badge variant="outline" className="text-[10px] mb-2">
        {message.role}
      </Badge>
      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mt-2 space-y-1">
          {message.toolCalls.map((tc) => (
            <div key={tc.id} className="text-xs font-mono bg-background/50 rounded px-2 py-1">
              <span className="text-muted-foreground">tool_call:</span>{" "}
              <span className="font-semibold">{tc.name}</span>
              ({JSON.stringify(tc.arguments)})
            </div>
          ))}
        </div>
      )}
      {message.toolResults && message.toolResults.length > 0 && (
        <div className="mt-2 space-y-1">
          {message.toolResults.map((tr) => (
            <div key={tr.id} className="text-xs font-mono bg-background/50 rounded px-2 py-1">
              <span className="text-muted-foreground">result ({tr.name}):</span>{" "}
              {tr.result.slice(0, 200)}
              {tr.result.length > 200 && "..."}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsiblePrompt({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="text-lg flex items-center justify-between">
          {title}
          <span className="text-muted-foreground text-sm font-normal">
            {open ? "collapse" : "expand"}
          </span>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent>
          <pre className="text-xs font-mono whitespace-pre-wrap bg-muted rounded-md p-3 max-h-96 overflow-y-auto">
            {content}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

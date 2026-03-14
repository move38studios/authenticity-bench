"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, RotateCcw, MessageSquare, ExternalLink } from "lucide-react";
import { useExperiment } from "../layout";
import { toast } from "sonner";

interface AnalysisChat {
  id: string;
  title: string | null;
  messageCount: number;
  updatedAt: string;
}

export default function ExperimentAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: experiment, fetchData } = useExperiment();
  const [generatingReport, setGeneratingReport] = useState(false);
  const [relatedChats, setRelatedChats] = useState<AnalysisChat[]>([]);
  const [creating, setCreating] = useState(false);

  // Load related analysis chats
  useEffect(() => {
    async function loadChats() {
      const res = await fetch("/api/analysis/chat");
      if (res.ok) {
        const json = await res.json();
        // Filter to chats that have this experiment loaded
        const related = (json.data as Array<{
          id: string;
          title: string | null;
          messageCount: number;
          updatedAt: string;
          loadedExperiments: Array<{ experimentId: string }>;
        }>).filter((chat) =>
          chat.loadedExperiments.some((e) => e.experimentId === id)
        );
        setRelatedChats(related);
      }
    }
    loadChats();
  }, [id]);

  async function handleRunAnalysis() {
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/experiments/${id}/analysis`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Analysis report generated");
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error || "Analysis failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setGeneratingReport(false);
      fetchData();
    }
  }

  async function handleStartAnalysis() {
    setCreating(true);
    try {
      const res = await fetch("/api/analysis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentId: id }),
      });
      if (res.ok) {
        const json = await res.json();
        router.push(`/dashboard/analysis/${json.data.id}`);
      } else {
        toast.error("Failed to create analysis chat");
      }
    } catch {
      toast.error("Failed to create analysis chat");
    } finally {
      setCreating(false);
    }
  }

  const analysisStatus = experiment?.analysisStatus;
  const hasReport = analysisStatus === "completed";

  return (
    <div className="space-y-6">
      {/* Auto-report section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Analysis Report</span>
            <div className="flex gap-2">
              {analysisStatus === "running" || generatingReport ? (
                <Button size="sm" disabled>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Generating...
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handleRunAnalysis}>
                  {hasReport ? (
                    <>
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-1" />
                      Run Analysis
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasReport ? (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {experiment?.analysisReport ?? ""}
            </div>
          ) : analysisStatus === "failed" ? (
            <p className="text-sm text-destructive">
              Analysis failed. Try running it again.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No report yet. Click &quot;Run Analysis&quot; to generate an automated
              analysis of this experiment&apos;s results.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Interactive analysis chats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Interactive Analysis</span>
            <Button size="sm" onClick={handleStartAnalysis} disabled={creating}>
              {creating ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <MessageSquare className="h-3 w-3 mr-1" />
              )}
              Start New Analysis
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Open an AI-powered analysis chat to explore this experiment&apos;s data
            with Python, create visualizations, and compare with other experiments.
          </p>

          {relatedChats.length > 0 ? (
            <div className="space-y-2">
              {relatedChats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/dashboard/analysis/${chat.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">
                      {chat.title || "Untitled chat"}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {chat.messageCount} msgs
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              No analysis chats for this experiment yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { useExperiment } from "../layout";

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const { data: experiment } = useExperiment();
  const [format, setFormat] = useState("csv");
  const [statusFilter, setStatusFilter] = useState("completed,refused");
  const [includeFullResponses, setIncludeFullResponses] = useState(false);

  function handleDownload() {
    const params = new URLSearchParams();
    params.set("format", format);
    params.set("status", statusFilter);
    if (includeFullResponses) params.set("full", "true");

    // Trigger download via window.location (the API sets Content-Disposition)
    window.location.href = `/api/experiments/${id}/export?${params}`;
  }

  const total = experiment?.totalJudgments ?? 0;
  const done = (experiment?.completedCount ?? 0) + (experiment?.failedCount ?? 0);

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Judgments</CardTitle>
          <CardDescription>
            Download experiment data for analysis in notebooks, spreadsheets, or other tools.
            {total > 0 && done < total && (
              <span className="block mt-1 text-amber-600">
                Note: {done} of {total} judgments completed — export will include available data only.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="jsonl">JSONL (newline-delimited)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div className="space-y-2">
            <Label>Include</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed,refused">Completed + Refused</SelectItem>
                <SelectItem value="completed">Completed only</SelectItem>
                <SelectItem value="all">All (including errors/pending)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Full responses toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="full-responses"
              checked={includeFullResponses}
              onCheckedChange={setIncludeFullResponses}
            />
            <Label htmlFor="full-responses" className="cursor-pointer">
              Include full responses
              <span className="block text-xs text-muted-foreground font-normal">
                Adds system prompts, user prompts, conversation logs, and raw responses. Makes files much larger.
              </span>
            </Label>
          </div>

          {/* Download */}
          <Button onClick={handleDownload} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download {format.toUpperCase()}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

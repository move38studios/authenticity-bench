"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareChatDialogProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShareSettings {
  sharingUuid: string | null;
  sharingEnabled: boolean;
}

export function ShareChatDialog({ chatId, open, onOpenChange }: ShareChatDialogProps) {
  const [settings, setSettings] = useState<ShareSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analysis/chat/${chatId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setSettings({
        sharingUuid: json.data.chat.sharingUuid ?? null,
        sharingEnabled: json.data.chat.sharingEnabled ?? false,
      });
    } catch {
      toast.error("Failed to load share settings");
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (open) fetchSettings();
  }, [open, fetchSettings]);

  const updateSettings = async (updates: { enabled?: boolean; regenerate?: boolean }) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/analysis/chat/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharingEnabled: updates.enabled,
          regenerate: updates.regenerate,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const json = await res.json();
      setSettings({
        sharingUuid: json.data.sharingUuid,
        sharingEnabled: json.data.sharingEnabled,
      });
      if (updates.regenerate) toast.success("Share link regenerated");
    } catch {
      toast.error("Failed to update share settings");
    } finally {
      setUpdating(false);
    }
  };

  const getShareUrl = () => {
    if (!settings?.sharingUuid) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/share/analysis/${settings.sharingUuid}`;
  };

  const copyLink = async () => {
    const url = getShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Chat</DialogTitle>
          <DialogDescription>
            Share this analysis conversation with others via a link.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : settings ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sharing-toggle" className="text-base">
                  Enable sharing
                </Label>
                <p className="text-sm text-muted-foreground">
                  Anyone with the link can view this chat
                </p>
              </div>
              <Switch
                id="sharing-toggle"
                checked={settings.sharingEnabled}
                onCheckedChange={(enabled) => updateSettings({ enabled })}
                disabled={updating}
              />
            </div>

            {settings.sharingEnabled && (
              <div className="space-y-2">
                <Label className="text-base">Share link</Label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={getShareUrl()}
                    readOnly
                    className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={copyLink} disabled={updating}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateSettings({ regenerate: true })}
                  disabled={updating}
                  className="text-muted-foreground"
                >
                  <RefreshCw className={cn("mr-2 h-3 w-3", updating && "animate-spin")} />
                  Regenerate link
                </Button>
                <p className="text-xs text-muted-foreground">
                  Regenerating will invalidate the previous link.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

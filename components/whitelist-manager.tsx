"use client";

import { useEffect, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";

interface WhitelistEntry {
  id: string;
  email: string | null;
  domain: string | null;
  createdAt: string;
}

export function WhitelistManager() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchEntries() {
    const res = await fetch("/api/admin/whitelist");
    if (res.ok) {
      setEntries(await res.json());
    }
  }

  useEffect(() => {
    fetchEntries();
  }, []);

  async function addEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/whitelist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to add");
    } else {
      setEmail("");
      await fetchEntries();
    }
    setLoading(false);
  }

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setError("");
    setLoading(true);

    const cleaned = domain.trim().toLowerCase().replace(/^@/, "");

    const res = await fetch("/api/admin/whitelist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: cleaned }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to add");
    } else {
      setDomain("");
      await fetchEntries();
    }
    setLoading(false);
  }

  async function remove(id: string) {
    await fetch(`/api/admin/whitelist?id=${id}`, { method: "DELETE" });
    await fetchEntries();
  }

  const emailEntries = entries.filter((e) => e.email);
  const domainEntries = entries.filter((e) => e.domain);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add email</CardTitle>
            <CardDescription>Allow a specific email address</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addEmail} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="email" className="sr-only">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading}>
                Add
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add domain</CardTitle>
            <CardDescription>Allow all emails from a domain</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addDomain} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="domain" className="sr-only">
                  Domain
                </Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading}>
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Whitelist</CardTitle>
          <CardDescription>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entries yet. Add an email or domain above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant="secondary">email</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.email}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {domainEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant="outline">domain</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      @{entry.domain}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

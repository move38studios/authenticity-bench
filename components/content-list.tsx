"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Pencil, Search } from "lucide-react";
import Link from "next/link";

interface ContentListProps<T> {
  title: string;
  description: string;
  apiPath: string;
  /** Base path for detail pages, e.g. "/dashboard/library/values" */
  detailPath: string;
  columns: { key: keyof T; label: string; render?: (value: T) => React.ReactNode }[];
  /** Keys to search against for client-side filtering */
  searchKeys?: (keyof T)[];
  renderCreateForm: (props: {
    onCreated: () => void;
  }) => React.ReactNode;
  /** Optional action buttons rendered next to the page title (e.g. Generate) */
  renderActions?: (props: { onRefresh: () => void }) => React.ReactNode;
}

function stringify(val: unknown): string {
  if (Array.isArray(val)) return val.join(" ");
  return String(val ?? "");
}

export function ContentList<T extends { id: string }>({
  title,
  description,
  apiPath,
  detailPath,
  columns,
  searchKeys,
  renderCreateForm,
  renderActions,
}: ContentListProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch(apiPath);
    if (res.ok) {
      const json = await res.json();
      setItems(json.data);
    }
    setLoading(false);
  }, [apiPath]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    if (!search.trim() || !searchKeys || searchKeys.length === 0) return items;
    const lc = search.toLowerCase();
    return items.filter((item) =>
      searchKeys.some((k) => stringify(item[k]).toLowerCase().includes(lc))
    );
  }, [items, search, searchKeys]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        {renderActions && renderActions({ onRefresh: fetchItems })}
      </div>

      {renderCreateForm({
        onCreated: fetchItems,
      })}

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {loading
              ? "Loading..."
              : filteredItems.length === items.length
                ? `${items.length} ${items.length === 1 ? "item" : "items"}`
                : `${filteredItems.length} of ${items.length} items`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {searchKeys && searchKeys.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {filteredItems.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? "No items yet. Create one above."
                : "No items match your search."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={String(col.key)}>{col.label}</TableHead>
                  ))}
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    {columns.map((col) => (
                      <TableCell key={String(col.key)}>
                        {col.render
                          ? col.render(item)
                          : String(item[col.key] ?? "")}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`${detailPath}/${item.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
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

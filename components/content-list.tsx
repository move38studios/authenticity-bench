"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
import { Trash2, Pencil } from "lucide-react";

interface ContentListProps<T> {
  title: string;
  description: string;
  apiPath: string;
  columns: { key: keyof T; label: string; render?: (value: T) => React.ReactNode }[];
  renderCreateForm: (props: {
    onCreated: () => void;
    editingItem: T | null;
    onCancelEdit: () => void;
  }) => React.ReactNode;
}

export function ContentList<T extends { id: string }>({
  title,
  description,
  apiPath,
  columns,
  renderCreateForm,
}: ContentListProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<T | null>(null);

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

  async function handleDelete(id: string) {
    await fetch(`${apiPath}/${id}`, { method: "DELETE" });
    await fetchItems();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>

      {renderCreateForm({
        onCreated: () => {
          fetchItems();
          setEditingItem(null);
        },
        editingItem,
        onCancelEdit: () => setEditingItem(null),
      })}

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {loading
              ? "Loading..."
              : `${items.length} ${items.length === 1 ? "item" : "items"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No items yet. Create one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={String(col.key)}>{col.label}</TableHead>
                  ))}
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    {columns.map((col) => (
                      <TableCell key={String(col.key)}>
                        {col.render
                          ? col.render(item)
                          : String(item[col.key] ?? "")}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

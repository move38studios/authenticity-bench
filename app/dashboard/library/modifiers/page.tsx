"use client";

import { ContentList } from "@/components/content-list";
import { MarkdownContentForm } from "@/components/markdown-content-form";

interface Modifier {
  id: string;
  name: string;
  content: string;
  description: string | null;
  createdAt: string;
}

export default function ModifiersPage() {
  return (
    <ContentList<Modifier>
      title="Modifiers"
      description="Prompt modifiers that change perceived stakes or dynamics. Can be combined."
      apiPath="/api/modifiers"
      columns={[
        { key: "name", label: "Name" },
        {
          key: "description",
          label: "Description",
          render: (item) => (
            <span className="text-muted-foreground">
              {item.description || "—"}
            </span>
          ),
        },
        {
          key: "content",
          label: "Length",
          render: (item) => (
            <span className="text-xs text-muted-foreground">
              {item.content.length.toLocaleString()} chars
            </span>
          ),
        },
      ]}
      renderCreateForm={(props) => (
        <MarkdownContentForm
          apiPath="/api/modifiers"
          entityName="Modifier"
          {...props}
        />
      )}
    />
  );
}

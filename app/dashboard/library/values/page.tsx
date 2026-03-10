"use client";

import { ContentList } from "@/components/content-list";
import { MarkdownContentForm } from "@/components/markdown-content-form";

interface ValuesSystem {
  id: string;
  name: string;
  content: string;
  description: string | null;
  createdAt: string;
}

export default function ValuesPage() {
  return (
    <ContentList<ValuesSystem>
      title="Values Systems"
      description="Complete values frameworks injected into the model's system prompt."
      apiPath="/api/values"
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
          apiPath="/api/values"
          entityName="Values System"
          {...props}
        />
      )}
    />
  );
}

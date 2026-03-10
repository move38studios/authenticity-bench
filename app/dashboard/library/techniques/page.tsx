"use client";

import { ContentList } from "@/components/content-list";
import { MarkdownContentForm } from "@/components/markdown-content-form";

interface MentalTechnique {
  id: string;
  name: string;
  content: string;
  description: string | null;
  createdAt: string;
}

export default function TechniquesPage() {
  return (
    <ContentList<MentalTechnique>
      title="Mental Techniques"
      description="Thinking approaches injected into the system prompt. Can be combined."
      apiPath="/api/techniques"
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
          apiPath="/api/techniques"
          entityName="Mental Technique"
          {...props}
        />
      )}
    />
  );
}

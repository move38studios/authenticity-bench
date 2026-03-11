"use client";

import { ContentList } from "@/components/content-list";
import { MarkdownContentForm } from "@/components/markdown-content-form";
import { GenerateDialog } from "@/components/generate-dialog";

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
      detailPath="/dashboard/library/values"
      searchKeys={["name", "description"]}
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
      renderCreateForm={({ onCreated }) => (
        <MarkdownContentForm
          apiPath="/api/values"
          entityName="Values System"
          onCreated={onCreated}
        />
      )}
      renderActions={({ onRefresh }) => (
        <GenerateDialog
          entityType="values_system"
          entityLabel="Values Systems"
          createApiPath="/api/values"
          onGenerated={onRefresh}
          mapToCreateBody={(item) => ({
            name: item.name,
            content: item.content,
            description: item.description,
          })}
        />
      )}
    />
  );
}

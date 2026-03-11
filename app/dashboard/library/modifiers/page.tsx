"use client";

import { ContentList } from "@/components/content-list";
import { MarkdownContentForm } from "@/components/markdown-content-form";
import { GenerateDialog } from "@/components/generate-dialog";

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
      detailPath="/dashboard/library/modifiers"
      searchKeys={["name", "description"]}
      columns={[
        { key: "name", label: "Name" },
        {
          key: "description",
          label: "Description",
          render: (item) => (
            <span className="text-muted-foreground truncate max-w-xs block">
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
          apiPath="/api/modifiers"
          entityName="Modifier"
          onCreated={onCreated}
        />
      )}
      renderActions={({ onRefresh }) => (
        <GenerateDialog
          entityType="modifier"
          entityLabel="Modifiers"
          createApiPath="/api/modifiers"
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

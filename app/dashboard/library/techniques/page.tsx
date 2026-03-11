"use client";

import { ContentList } from "@/components/content-list";
import { MarkdownContentForm } from "@/components/markdown-content-form";
import { GenerateDialog } from "@/components/generate-dialog";

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
      detailPath="/dashboard/library/techniques"
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
          apiPath="/api/techniques"
          entityName="Mental Technique"
          onCreated={onCreated}
        />
      )}
      renderActions={({ onRefresh }) => (
        <GenerateDialog
          entityType="mental_technique"
          entityLabel="Techniques"
          createApiPath="/api/techniques"
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

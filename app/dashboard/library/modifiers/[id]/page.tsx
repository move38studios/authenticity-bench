"use client";

import { use } from "react";
import { ContentDetailPage } from "@/components/content-detail-page";

export default function ModifierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ContentDetailPage
      id={id}
      entityName="Modifier"
      apiPath="/api/modifiers"
      backPath="/dashboard/library/modifiers"
    />
  );
}

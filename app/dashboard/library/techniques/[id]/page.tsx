"use client";

import { use } from "react";
import { ContentDetailPage } from "@/components/content-detail-page";

export default function TechniqueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ContentDetailPage
      id={id}
      entityName="Mental Technique"
      apiPath="/api/techniques"
      backPath="/dashboard/library/techniques"
    />
  );
}

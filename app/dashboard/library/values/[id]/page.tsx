"use client";

import { use } from "react";
import { ContentDetailPage } from "@/components/content-detail-page";

export default function ValueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ContentDetailPage
      id={id}
      entityName="Values System"
      apiPath="/api/values"
      backPath="/dashboard/library/values"
    />
  );
}

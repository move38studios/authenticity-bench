"use client";

import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-10 bg-background flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 h-4" />
      <Link href="/admin">
        <h1 className="text-sm font-medium cursor-pointer hover:text-primary/80">
          Admin Panel
        </h1>
      </Link>
    </header>
  );
}

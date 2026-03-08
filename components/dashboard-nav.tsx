"use client";

import Link from "next/link";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface DashboardNavProps {
  user: {
    name: string;
    email: string;
    role?: string | null;
  };
}

export function DashboardNav({ user }: DashboardNavProps) {
  const router = useRouter();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="font-serif text-lg font-semibold tracking-tight"
          >
            Authenticity Bench
          </Link>
          {user.role === "admin" && (
            <Link
              href="/dashboard/admin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {user.email}
            {user.role === "admin" && (
              <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                admin
              </span>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              router.push("/sign-in");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

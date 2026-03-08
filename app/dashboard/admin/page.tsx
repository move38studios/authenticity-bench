import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WhitelistManager } from "@/components/whitelist-manager";

export default async function AdminPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-semibold tracking-tight">
          Admin
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage whitelisted emails and domains.
        </p>
      </div>

      <WhitelistManager />
    </div>
  );
}

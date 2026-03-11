import { WhitelistManager } from "@/components/whitelist-manager";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
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

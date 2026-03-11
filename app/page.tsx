import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-lg text-center space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight">
          Authenticity Bench
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          A controlled environment for running benchmarks across AI models.
          Evaluate authenticity, reasoning, and capabilities with structured
          tests.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

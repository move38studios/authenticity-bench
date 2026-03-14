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
          Measure how honest and self-consistent LLMs really are. Run
          experiments across models, values systems, and judgment modes to see
          if what they say matches what they do.
        </p>
        <Button asChild size="lg">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}

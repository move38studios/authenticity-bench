import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Run and review AI model benchmarks.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Benchmarks Run</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              No benchmarks yet
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Models Tested</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Add models to get started
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Latest Score</CardDescription>
            <CardTitle className="text-2xl">&mdash;</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Run a benchmark to see results
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

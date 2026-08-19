"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import { downloadAuditExport } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";

// The Administrator role's only real capability today is the audit export
// (routes/compliance.ts) - SEC-001 §3.2 also names "system config" and
// "user role management" for this role, but neither has a backend yet
// (DL-SEC-002's Consequences note explicitly defers that). This page
// exposes exactly what exists rather than mocking up controls for
// endpoints that don't.
export default function AdminPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const role = session?.user?.role;

  const [format, setFormat] = React.useState<"json" | "csv">("csv");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [entityType, setEntityType] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const exportMutation = useMutation({
    mutationFn: () =>
      downloadAuditExport(accessToken!, {
        format,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        entityType: entityType.trim() || undefined,
      }),
    onError: (err: Error) => setError(err.message),
    onSuccess: () => setError(null),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      {role !== undefined && role !== "Administrator" ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            This page is only available to Administrators. The API enforces this independently
            (SEC-001 §3.2) - this message is a UX courtesy, not the real boundary.
          </p>
        </Card>
      ) : (
        <Card>
          <h2 className="font-display mb-4 text-lg font-semibold">Compliance audit export</h2>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Format
              <select
                className="rounded-md border border-border bg-background p-2 text-sm text-foreground"
                value={format}
                onChange={(e) => setFormat(e.target.value as "json" | "csv")}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label
              htmlFor="export-from"
              className="flex flex-col gap-1 text-xs text-muted-foreground"
            >
              From (optional)
              <Input
                id="export-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label
              htmlFor="export-to"
              className="flex flex-col gap-1 text-xs text-muted-foreground"
            >
              To (optional)
              <Input
                id="export-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label
              htmlFor="export-entity-type"
              className="flex flex-col gap-1 text-xs text-muted-foreground"
            >
              Entity type (optional, e.g. &quot;task&quot;, &quot;hitl_queue_item&quot;)
              <Input
                id="export-entity-type"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                placeholder="Leave blank for all entity types"
              />
            </label>
            {error && (
              <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm">
                {error}
              </div>
            )}
            <Button
              className="self-start"
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              {exportMutation.isPending ? "Exporting…" : "Export"}
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}

// Administrator-only. The audit export endpoint returns a raw downloadable
// file (CSV/JSON), not the {success, data, error} envelope every other
// route uses (routes/compliance.ts's own header explains why) - so this
// can't reuse api-client.ts's apiFetch, which assumes a JSON envelope
// body.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function downloadAuditExport(
  accessToken: string,
  params: { format: "json" | "csv"; from?: string; to?: string; entityType?: string },
): Promise<void> {
  const search = new URLSearchParams({ format: params.format });
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.entityType) search.set("entityType", params.entityType);

  const res = await fetch(`${API_URL}/api/v1/compliance/audit-export?${search.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Export failed with status ${res.status}.`);
  }

  // The API sets Content-Disposition with a real filename - fall back to a
  // generic one only if that header is somehow missing.
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filenameMatch = /filename="([^"]+)"/.exec(disposition);
  const filename = filenameMatch?.[1] ?? `nyxor-audit-export.${params.format}`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

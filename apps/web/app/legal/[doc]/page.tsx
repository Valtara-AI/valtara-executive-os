import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import Link from "next/link";
import { renderLegalMarkdown } from "@/lib/render-legal-markdown";

// Renders docs/06-legal/*.md directly (fs.readFileSync at request time) so
// there is exactly one source of truth for legal content - duplicating
// this text into JSX here would drift from the real document the same way
// VEX-OS-DMP-001's sub-processor table had drifted before this page was
// added. Rendered as preformatted text rather than parsed Markdown: no
// new dependency for a v1 legal page, at the cost of no rich formatting -
// revisit once the marketing site (a separate, not-yet-scoped piece of
// work) needs real design investment here too.
//
// Production caveat: this reads a path outside apps/web's own directory
// (../../docs/06-legal) - confirm docs/ is actually present in whatever
// deploys this (Vercel's default file-tracing may exclude it) before this
// route is relied on in a real deployment, not just local staging.

const DOC_FILES: Record<string, string> = {
  terms: "VEX-OS-LGL-001-Terms-of-Service.md",
  privacy: "VEX-OS-LGL-002-Privacy-Policy.md",
  dpa: "VEX-OS-LGL-003-Data-Processing-Agreement.md",
  cookies: "VEX-OS-LGL-004-Cookie-Policy.md",
};

export function generateStaticParams() {
  return Object.keys(DOC_FILES).map((doc) => ({ doc }));
}

export default async function LegalDocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const filename = DOC_FILES[doc];
  if (!filename) notFound();

  const filePath = path.join(process.cwd(), "..", "..", "docs", "06-legal", filename);
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Link className="text-sm underline" href="/legal">
        &larr; All legal documents
      </Link>
      <article>{renderLegalMarkdown(content)}</article>
    </main>
  );
}

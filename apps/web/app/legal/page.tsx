import Link from "next/link";

// Unauthenticated, public route (proxy.ts's matcher only covers /onboarding,
// /dashboard, /admin) - deliberately, since these documents need to be
// reachable without signing in (Google/Microsoft OAuth verification
// requires a live privacy policy URL, and a prospect needs to read the
// Terms before ever creating an account).

const DOCS = [
  { slug: "terms", label: "Terms of Service" },
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "dpa", label: "Data Processing Agreement" },
  { slug: "cookies", label: "Cookie Policy" },
] as const;

export default function LegalIndexPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Legal</h1>
      <p className="text-sm text-muted-foreground">
        These documents are drafts pending legal counsel review, published here as the current
        source of truth about how VEX-OS actually handles your data - not yet the final, approved
        versions.
      </p>
      <ul className="flex flex-col gap-2">
        {DOCS.map((doc) => (
          <li key={doc.slug}>
            <Link className="underline" href={`/legal/${doc.slug}`}>
              {doc.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

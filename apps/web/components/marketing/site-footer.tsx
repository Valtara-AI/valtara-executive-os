import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Logo variant="mark" className="h-6 w-6" />
            <span className="font-display font-semibold">vexOS</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Valtara Inc., Saskatoon, Saskatchewan, Canada
          </p>
          <a
            href="mailto:fcogbogu@gmail.com"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            fcogbogu@gmail.com
          </a>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Legal</span>
          {LEGAL_DOCS.map((doc) => (
            <Link
              key={doc.slug}
              href={`/legal/${doc.slug}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {doc.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

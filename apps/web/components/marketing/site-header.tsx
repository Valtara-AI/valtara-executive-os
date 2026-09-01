import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { href: "#hitl", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#integrations", label: "Integrations" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="glass-panel sticky top-0 z-10 rounded-none">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo variant="mark" priority className="h-8 w-8" />
          <span className="font-display text-lg font-semibold">Nyxor</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button size="sm" asChild>
            <a href="/api/auth/signin">Start free trial</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

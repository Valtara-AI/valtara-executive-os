import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

// Branding/04-website-theme.md's hero direction, adapted to what's
// actually built (see hitl-showcase.tsx / how-it-works.tsx for the parts
// of the brand system's copy - "Decision Intelligence," "Memory / Second
// Brain" - that describe positioning aspirations rather than shipped
// features, and were deliberately not used here).
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{ backgroundImage: "var(--intelligence-gradient)", filter: "blur(120px)" }}
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-24 text-center">
        <Logo variant="full" priority className="max-w-xs" />
        <h1 className="font-display max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Your Executive Intelligence. Operating as One System.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          vexOS brings your agent workforce, approvals, and integrations into one executive
          operating environment — where nothing acts on your behalf without your sign-off.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <a href="/api/auth/signin">Start free trial</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="mailto:fcogbogu@gmail.com?subject=vexOS%20Demo%20Request">Talk to us</a>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          14-day free trial · No hidden credit meters · Cancel anytime
        </p>
      </div>
    </section>
  );
}

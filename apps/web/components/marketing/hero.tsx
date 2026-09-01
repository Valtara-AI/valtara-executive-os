import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

// Branding/04-website-theme.md's hero direction, adapted to what's
// actually built (see hitl-showcase.tsx / how-it-works.tsx for the parts
// of the brand system's copy - "Decision Intelligence," "Memory / Second
// Brain" - that describe positioning aspirations rather than shipped
// features, and were deliberately not used here).
//
// DL-PROD-005: the full wordmark lockup (Logo variant="full") was removed
// from here for a while - the only lockup asset that existed was old,
// trademark-conflicting vexOS artwork, and shipping that on the site's most
// visible surface was worse than showing nothing. Restored now that a real
// Nyxor lockup exists (light/dark themed pair - see logo.tsx).
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* Two blobs on independent, offset animation durations (globals.css's
          hero-orbit-a/b) rather than one - moving in lockstep would read as
          mechanical; drifting independently reads as ambient. */}
      <div
        className="hero-orb-a pointer-events-none absolute -left-1/4 top-0 h-[36rem] w-[36rem] opacity-25"
        style={{ backgroundImage: "var(--intelligence-gradient)", filter: "blur(120px)" }}
        aria-hidden
      />
      <div
        className="hero-orb-b pointer-events-none absolute -right-1/4 bottom-0 h-[30rem] w-[30rem] opacity-20"
        style={{ backgroundImage: "var(--intelligence-gradient)", filter: "blur(120px)" }}
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-24 text-center">
        <Logo variant="full" priority className="max-w-sm" />
        <h1 className="font-display max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Your Executive Intelligence. Operating as One System.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Nyxor brings your agent workforce, approvals, and integrations into one executive
          operating environment — where nothing acts on your behalf without your sign-off.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <a href="/api/auth/signin">Start free trial</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="mailto:fcogbogu@gmail.com?subject=Nyxor%20Demo%20Request">Talk to us</a>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          14-day free trial · No hidden credit meters · Cancel anytime
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {["Morning briefs, on time", "6 executive capabilities", "100% HITL-governed"].map(
            (stat) => (
              <span
                key={stat}
                className="glass-panel hover-float rounded-full px-4 py-2 text-xs font-medium text-muted-foreground"
              >
                {stat}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

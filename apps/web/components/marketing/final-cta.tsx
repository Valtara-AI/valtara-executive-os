import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-surface py-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{ backgroundImage: "var(--intelligence-gradient)", filter: "blur(140px)" }}
        aria-hidden
      />
      <Reveal className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          Run your company. Not your chaos.
        </h2>
        <p className="text-muted-foreground">
          Meet vexOS — the Executive Operating System built for leaders who operate at scale.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <a href="/api/auth/signin">Start free trial</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="mailto:fcogbogu@gmail.com?subject=vexOS%20Demo%20Request">Talk to us</a>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

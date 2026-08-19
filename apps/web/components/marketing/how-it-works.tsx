import { ClipboardList, Users, LayoutDashboard, Sparkles } from "lucide-react";
import { Reveal } from "./reveal";

// The real, built flow (apps/api/src/domains/onboarding/, dashboard) - not
// the brand system's aspirational "Command Center"/"Memory" framing
// (Branding/06-executive-command-center.md), which describes product
// direction that isn't built yet.
const STEPS = [
  {
    icon: ClipboardList,
    title: "Onboarding interview",
    description:
      "A structured interview builds your Executive Intelligence Profile and Voice Profile.",
  },
  {
    icon: Sparkles,
    title: "Your agent workforce",
    description: "vexOS proposes a set of agents matched to your role — you review and confirm.",
  },
  {
    icon: Users,
    title: "Agents get to work",
    description: "Each agent handles its responsibilities within its connected integrations.",
  },
  {
    icon: LayoutDashboard,
    title: "You review, always",
    description: "Every consequential output lands in your dashboard for approval first.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">How vexOS works</h2>
        </Reveal>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delayMs={i * 80}>
              <div className="flex flex-col gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <step.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-display font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

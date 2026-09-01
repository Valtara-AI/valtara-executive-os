import { ShieldCheck, FileEdit, UserCheck, Send } from "lucide-react";
import { Reveal } from "./reveal";

// The #1 differentiator - concrete, traceable to the real database trigger
// (packages/database/src/migrations/0001_hitl_enforcement.sql) and
// CLAUDE.md's "HITL IS ARCHITECTURAL" non-negotiable #4, not generic
// "enterprise-grade security" language.
const STEPS = [
  {
    icon: FileEdit,
    title: "Agent drafts",
    description: "An agent completes a task — a reply, a calendar event, a document.",
  },
  {
    icon: ShieldCheck,
    title: "Held for review",
    description: "Nothing leaves Nyxor. The output sits in your HITL queue, unsent.",
  },
  {
    icon: UserCheck,
    title: "You approve",
    description: "Approve, edit, or reject — your call, every time.",
  },
  {
    icon: Send,
    title: "Only then, action",
    description: "A database constraint — not a setting — verifies approval before anything sends.",
  },
];

export function HitlShowcase() {
  return (
    <section id="hitl" className="bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Human-in-the-loop isn&apos;t a setting. It&apos;s architecture.
          </h2>
          <p className="mt-4 text-muted-foreground">
            No agent operating under your account can send an email, post a message, or modify your
            calendar without your prior approval — enforced by a database constraint that exists
            independently of any application code, not a toggle you (or a bug) could turn off.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delayMs={i * 80}>
              <div className="glass-panel hover-float flex h-full flex-col gap-3 rounded-lg p-6">
                <step.icon className="h-6 w-6 text-accent" aria-hidden />
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

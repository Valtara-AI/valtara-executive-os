import { Sunrise, LineChart, BookOpen, Mic, Users, Plug } from "lucide-react";
import { Reveal } from "./reveal";
import { Carousel } from "./carousel";

// Every real, built capability - the previous landing page named none of
// these explicitly (only implied "agent workforce" and "HITL" generically),
// even though Portfolio/Breaking News, Personal Development, and
// Articulation Training all shipped this session. This section exists
// specifically to close that gap.
const CAPABILITIES = [
  {
    icon: Sunrise,
    title: "Morning brief",
    description:
      "Your day, your calendar, your inbox, your portfolio, and the headlines that actually matter to you - one brief, waiting before 6am.",
  },
  {
    icon: LineChart,
    title: "Portfolio & breaking news",
    description:
      "Track the tickers you care about and get news filtered to your stated priorities, not a generic feed - folded straight into your morning brief.",
  },
  {
    icon: BookOpen,
    title: "Personal development",
    description:
      "A reading and listening list curated to your role and industry, refreshed weekly - books, podcasts, and publications, never repeated.",
  },
  {
    icon: Mic,
    title: "Articulation training",
    description:
      "Direct, scored feedback on a pitch, board speech, or deal-closing conversation - type it or record it, clarity/structure/persuasiveness/tone scored every time.",
  },
  {
    icon: Users,
    title: "Your agent workforce",
    description:
      "Agents matched to your actual time drains from a real onboarding interview, not a generic template - each with its own responsibilities and approval mode.",
  },
  {
    icon: Plug,
    title: "Works where you work",
    description:
      "Google, Microsoft, Slack, and PandaDoc - scoped to exactly what each agent needs, never a bulk download of your mailbox.",
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            One system. Everything an executive&apos;s day actually needs.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Not a chatbot bolted onto a calendar. A working set of capabilities that grows with you.
          </p>
        </Reveal>

        <div className="mt-16">
          <Carousel>
            {CAPABILITIES.map((capability) => (
              <div
                key={capability.title}
                className="glass-panel hover-float flex h-full w-72 flex-col gap-3 rounded-xl p-6 sm:w-80"
              >
                <capability.icon className="h-6 w-6 text-accent" aria-hidden />
                <h3 className="font-display font-semibold">{capability.title}</h3>
                <p className="text-sm text-muted-foreground">{capability.description}</p>
              </div>
            ))}
          </Carousel>
        </div>
      </div>
    </section>
  );
}

import { Marquee } from "./marquee";

const BADGES = [
  "Morning Briefs",
  "Portfolio Tracking",
  "Breaking News",
  "Personal Development",
  "Articulation Training",
  "Agent Workforce",
  "HITL Governance",
  "Google · Microsoft · Slack · PandaDoc",
];

export function CapabilityMarquee() {
  return (
    <div className="border-y border-border bg-surface py-4">
      <Marquee
        items={BADGES.map((label) => (
          <span
            key={label}
            className="mx-4 flex items-center gap-4 text-sm font-medium text-muted-foreground"
          >
            {label}
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
          </span>
        ))}
      />
    </div>
  );
}

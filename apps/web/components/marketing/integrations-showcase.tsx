import { Mail, CalendarDays, MessagesSquare, FileText } from "lucide-react";
import { Reveal } from "./reveal";
import { FeatureGrid } from "./feature-grid";

// Exactly the four real, built integrations (packages/integrations/src/*)
// - no placeholder/aspirational integrations.
const INTEGRATIONS = [
  { icon: Mail, title: "Google", description: "Gmail + Google Calendar." },
  { icon: CalendarDays, title: "Microsoft", description: "Outlook Mail + Calendar + Teams." },
  { icon: MessagesSquare, title: "Slack", description: "Channel messages and posts." },
  { icon: FileText, title: "PandaDoc", description: "Board and investor document workflows." },
];

export function IntegrationsShowcase() {
  return (
    <section id="integrations" className="bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Works where you already work
          </h2>
          <p className="mt-4 text-muted-foreground">
            vexOS requests only the access each agent actually needs — never a bulk download of your
            mailbox or calendar history.
          </p>
        </Reveal>

        <div className="mt-16">
          <FeatureGrid items={INTEGRATIONS} />
        </div>
      </div>
    </section>
  );
}

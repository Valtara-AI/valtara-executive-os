import type { LucideIcon } from "lucide-react";
import { Reveal } from "./reveal";

export interface FeatureGridItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function FeatureGrid({ items }: { items: FeatureGridItem[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {items.map((item, i) => (
        <Reveal key={item.title} delayMs={i * 80}>
          <div className="glass-panel hover-float flex h-full flex-col gap-3 rounded-lg p-6">
            <item.icon className="h-6 w-6 text-accent" aria-hidden />
            <h3 className="font-display font-semibold">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

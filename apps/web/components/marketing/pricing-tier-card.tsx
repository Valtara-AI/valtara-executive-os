import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { TierDisplay } from "./pricing-display";

export function PricingTierCard({ tier }: { tier: TierDisplay }) {
  const ctaHref =
    tier.ctaLabel === "Contact us"
      ? "mailto:fcogbogu@gmail.com?subject=Nyxor%20Enterprise%20Inquiry"
      : "/api/auth/signin";

  return (
    <div
      className={cn(
        "glass-panel hover-float flex flex-col gap-6 rounded-lg p-8",
        tier.highlighted && "border-primary shadow-lg",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold">{tier.name}</h3>
        {tier.highlighted && <Badge variant="accent">Most popular</Badge>}
      </div>
      <div>
        <span className="font-display text-3xl font-bold">{tier.priceLabel}</span>
      </div>
      <p className="text-sm text-muted-foreground">{tier.tagline}</p>
      <ul className="flex flex-col gap-2">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button variant={tier.highlighted ? "default" : "outline"} asChild className="mt-auto">
        <a href={ctaHref}>{tier.ctaLabel}</a>
      </Button>
    </div>
  );
}

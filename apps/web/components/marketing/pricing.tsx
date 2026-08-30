import { PRICING_DISPLAY, TRIAL_LABEL } from "./pricing-display";
import { PricingTierCard } from "./pricing-tier-card";
import { Reveal } from "./reveal";

// Order matches SubscriptionTier's own declaration order in
// @nyxor/billing/tiers, not alphabetical - starter (Plus) -> pro ->
// enterprise is the intended left-to-right reading order.
const TIER_ORDER = ["starter", "pro", "enterprise"] as const;

export function Pricing() {
  return (
    <section id="pricing" className="bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Simple, predictable pricing
          </h2>
          <p className="mt-4 text-muted-foreground">{TRIAL_LABEL}</p>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {TIER_ORDER.map((key, i) => (
            <Reveal key={key} delayMs={i * 80}>
              <PricingTierCard tier={PRICING_DISPLAY[key]} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

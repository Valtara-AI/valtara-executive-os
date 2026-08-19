import { SiteHeader } from "./site-header";
import { Hero } from "./hero";
import { HitlShowcase } from "./hitl-showcase";
import { HowItWorks } from "./how-it-works";
import { IntegrationsShowcase } from "./integrations-showcase";
import { Pricing } from "./pricing";
import { FinalCta } from "./final-cta";
import { SiteFooter } from "./site-footer";

// Server component - no client-only state at this level (ThemeToggle and
// Reveal, both "use client", are leaves rendered inside it, which is fine:
// a Server Component can render Client Components as children).
export function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <HitlShowcase />
        <HowItWorks />
        <IntegrationsShowcase />
        <Pricing />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

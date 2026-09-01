import { SiteHeader } from "./site-header";
import { Hero } from "./hero";
import { CapabilityMarquee } from "./capability-marquee";
import { Capabilities } from "./capabilities";
import { HitlShowcase } from "./hitl-showcase";
import { HowItWorks } from "./how-it-works";
import { IntegrationsShowcase } from "./integrations-showcase";
import { Pricing } from "./pricing";
import { FinalCta } from "./final-cta";
import { SiteFooter } from "./site-footer";

// Server component - no client-only state at this level (ThemeToggle,
// Reveal, and Carousel, all "use client", are leaves rendered inside it,
// which is fine: a Server Component can render Client Components as
// children). Capabilities/CapabilityMarquee added to close a real gap:
// the page previously named none of Portfolio/News, Personal Development,
// or Articulation Training explicitly, even though all three shipped.
export function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <CapabilityMarquee />
        <Capabilities />
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

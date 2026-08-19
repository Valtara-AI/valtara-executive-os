"use client";

import * as React from "react";
import { useInView } from "@/lib/use-in-view";
import { cn } from "@/lib/cn";

// 180-400ms range per Branding/18-motion-language.md's motion guidance -
// "sophisticated and restrained," not a showy scroll-jacking effect.
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={cn(
        // "reveal-pending" is a plain (non-Tailwind) class, not just
        // opacity-0/translate-y-4 directly - globals.css's `noscript`
        // fallback overrides it, so content stays fully visible for any
        // client that never runs JS at all (search crawlers with limited
        // JS budgets, accessibility tools, a JS-disabled browser) rather
        // than depending on the IntersectionObserver ever firing.
        "transition-all duration-300 ease-out",
        inView ? "translate-y-0 opacity-100" : "reveal-pending translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

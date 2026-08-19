import Image from "next/image";
import { cn } from "@/lib/cn";

// Branding/03-logo-architecture.md: the supplied image is the "Primary
// Horizontal Lockup" (full wordmark + orbital V, apps/web/public/vexos-logo.png,
// 1536x1024) - only that one family member exists today. `apps/web/public/
// vexos-mark.png` (512x512, transparent) is a cropped standalone V, derived
// from it for contexts too tight for the full lockup (nav bar, favicon
// source). Reversed/monochrome variants, a real favicon-optimized asset,
// and a motion logo are still unbuilt - see that file for the full family
// list and clear-space/do-not rules.

interface LogoProps {
  /** "mark" = standalone orbital V only (nav, tight spaces). "full" = complete horizontal lockup (hero, footer). */
  variant?: "mark" | "full";
  className?: string;
  priority?: boolean;
}

export function Logo({ variant = "mark", className, priority }: LogoProps) {
  if (variant === "full") {
    return (
      <Image
        src="/vexos-logo.png"
        alt="vexOS — Smarter Systems. Bolder Possibilities."
        width={1536}
        height={1024}
        priority={priority}
        className={cn("h-auto w-full max-w-md", className)}
      />
    );
  }

  return (
    <Image
      src="/vexos-mark.png"
      alt="vexOS"
      width={512}
      height={512}
      priority={priority}
      className={cn("h-8 w-8", className)}
    />
  );
}

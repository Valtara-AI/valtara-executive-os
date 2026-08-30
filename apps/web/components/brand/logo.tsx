import Image from "next/image";
import { cn } from "@/lib/cn";

// Branding/03-logo-architecture.md. DL-PROD-005: rebranded from vexOS to
// Nyxor (trademark conflict).
//
// Both variants now use the CAO-supplied source lockups (Branding/
// nyxor-logo-source-{light,dark}-bg.png), chroma-keyed to transparency -
// a much cleaner extraction than a first attempt at "mark" (a glow-on-black
// render with soft, detail-heavy edges that turned to mush at 16-32px
// icon/favicon size; see git history on this file). These sources have
// crisp, near-vector edges that hold up down to 16px - verified directly
// before wiring in, not assumed.
//
// "full" is a light/dark PAIR, not one image re-tinted: the two source
// renders use different wordmark text colors by design (dark navy on the
// light-bg source, medium blue on the dark-bg source) for contrast against
// their respective surfaces, so both are shipped and toggled via Tailwind's
// `dark:` variant (configured against `[data-theme="dark"]`, tailwind.config.ts)
// rather than picking one and hoping it works on both backgrounds.
//
// "mark" (the standalone orbital N) uses one shared asset cropped from the
// dark-bg source - its gradient is consistent between both source renders,
// unlike the wordmark text, so no light/dark pair is needed there.
//
// All three images pass `unoptimized` deliberately: Next's built-in image
// optimizer re-encoded these as 8-bit indexed/palette PNGs (<=256 colors,
// confirmed by inspecting the actual bytes it served), which introduces
// visible dithering/banding on a smooth gradient - the real cause of the
// small-size mush the first "mark" attempt was blamed for, still present
// even after switching to this much cleaner source. The optimizer's
// responsive-breakpoint generation isn't useful here anyway (these are
// small, fixed-size brand marks, not hero photography), so bypassing it
// entirely is the fix, not tuning `quality`.
//
// Used today: "mark" in site-header.tsx/site-footer.tsx and as the
// favicon; "full" in hero.tsx (restored once real Nyxor art existed -
// it had been removed while the only lockup asset was old vexOS artwork).

interface LogoProps {
  /** "mark" = standalone orbital N (nav, tight spaces, favicon). "full" = complete horizontal lockup, light/dark themed pair - currently unused by any caller (see file header). */
  variant?: "mark" | "full";
  className?: string;
  priority?: boolean;
}

export function Logo({ variant = "mark", className, priority }: LogoProps) {
  if (variant === "full") {
    return (
      <>
        <Image
          src="/nyxor-logo-light.png"
          alt="Nyxor"
          width={1605}
          height={463}
          priority={priority}
          unoptimized
          className={cn("h-auto w-full max-w-md dark:hidden", className)}
        />
        <Image
          src="/nyxor-logo-dark.png"
          alt="Nyxor"
          width={1964}
          height={547}
          priority={priority}
          unoptimized
          className={cn("hidden h-auto w-full max-w-md dark:block", className)}
        />
      </>
    );
  }

  return (
    <Image
      src="/nyxor-mark.png"
      alt="Nyxor"
      width={512}
      height={512}
      priority={priority}
      unoptimized
      className={cn("h-8 w-8", className)}
    />
  );
}

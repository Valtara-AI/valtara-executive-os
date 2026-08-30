import type { Metadata } from "next";
import { Inter, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { STORAGE_KEY } from "@/store/theme-store";

// Branding/02-core-visual-system.md's typography hierarchy: Inter is the
// Interface/body default (`font-sans`, tailwind.config.ts), Manrope is
// Display/H1/H2/Metrics (`font-display`, used deliberately, not everywhere),
// IBM Plex Mono is System/data labels (`font-mono`). next/font self-hosts
// all three at build time - no runtime Google Fonts request in production.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-plex-mono",
});

// DL-PROD-003: "Nyxor" is the customer-facing brand name (matches the
// provided logo's own typography); "NYXOR" stays the internal engineering
// identifier (package names, doc IDs) and is unaffected by this.
export const metadata: Metadata = {
  title: "Nyxor — Smarter Systems. Bolder Possibilities.",
  description:
    "Nyxor is the Executive Operating System — AI agents, governed by human approval on every action, built for how executives actually work.",
};

// Phase A theme-flash fix: the toggle (store/theme-store.ts) applies
// data-theme via a useEffect after mount, so without this a dark-mode
// visitor sees a flash of the light theme on every load - worst on the
// landing page, the single highest-traffic, most first-impression-sensitive
// route in the app. This blocking script runs before first paint and
// mirrors getInitialTheme()'s exact logic (stored preference, else
// prefers-color-scheme). initTheme() still runs on mount as before -
// idempotent, just no longer the *first* write.
const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} ${plexMono.variable}`}
      // The blocking script below sets data-theme before React hydrates,
      // which the server-rendered HTML can never predict (it doesn't know
      // the client's localStorage/OS preference) - this is the standard,
      // expected SSR-dark-mode hydration mismatch, not a real bug (the same
      // pattern libraries like next-themes suppress internally). Scoped to
      // just this one attribute on this one element, not a blanket
      // suppression of real hydration bugs elsewhere in the app.
      suppressHydrationWarning
    >
      {/* No manual favicon <link> - Next.js's file-convention icon
          (app/icon.png) auto-injects the right <link rel="icon"> tag.
          DL-PROD-005: same source-derived Nyxor mark as components/brand/
          logo.tsx's "mark" variant - see that file for asset provenance. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {/* Only rendered as active CSS when JS never runs at all (browsers
            skip <noscript> contents once JS is enabled) - guarantees
            components/marketing/reveal.tsx's scroll-in sections are never
            permanently blank for a client that can't run the
            IntersectionObserver that would otherwise reveal them. */}
        <noscript>
          <style>{`.reveal-pending { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

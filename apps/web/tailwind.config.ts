import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// Dark/light mode via the `data-theme` attribute on <html> (SAD §4.1),
// not the `class` strategy - keeps the toggle mechanism uniform with how
// the rest of the design system (CSS custom properties in globals.css)
// expects to be driven.
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        // DL-PROD-003 / Phase A: Nyxor brand palette additions.
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        surface: "hsl(var(--surface))",
      },
      fontFamily: {
        // Branding/02-core-visual-system.md's hierarchy: Inter is the
        // Interface/body font (the default, most-used typeface - `font-sans`
        // resolves to it app-wide via layout.tsx's next/font setup so
        // existing text doesn't need per-element font classes). Manrope is
        // reserved for Display/H1/H2/Metrics - a deliberate `font-display`
        // utility, not the default, so it stays used sparingly for emphasis
        // rather than becoming the everyday body font. IBM Plex Mono is
        // System/data labels only.
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-manrope)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-plex-mono)", ...defaultTheme.fontFamily.mono],
      },
    },
  },
  plugins: [],
};

export default config;

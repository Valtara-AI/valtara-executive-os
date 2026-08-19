// Single source of truth for the legal document list - shared by
// app/legal/page.tsx (the index) and components/marketing/site-footer.tsx
// (the landing page's footer links), so the two can never list a different
// set of documents or point at different slugs. Same anti-duplication
// reasoning as app/legal/[doc]/page.tsx reading docs/06-legal/*.md
// directly instead of copying its content into JSX.

export const LEGAL_DOCS = [
  { slug: "terms", label: "Terms of Service" },
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "dpa", label: "Data Processing Agreement" },
  { slug: "cookies", label: "Cookie Policy" },
] as const;

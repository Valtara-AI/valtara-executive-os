/** @type {import('next').NextConfig} */
const nextConfig = {
  // Minimizes the production Docker image (SAD §5: "Docker-deployable
  // backend" / no Vercel dependency) by tracing only the files each route
  // actually needs into .next/standalone.
  output: "standalone",
  reactStrictMode: true,
  // Next 16 default-scaffolds AGENTS.md/CLAUDE.md into this directory on
  // every dev/build run. This repo already has a real, hand-maintained
  // CLAUDE.md at the root - a second auto-generated one here would be
  // confusing at best, so this is off rather than something to keep
  // re-deleting.
  agentRules: false,
};

export default nextConfig;

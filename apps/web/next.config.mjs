/** @type {import('next').NextConfig} */
const nextConfig = {
  // Minimizes the production Docker image (SAD §5: "Docker-deployable
  // backend" / no Vercel dependency) by tracing only the files each route
  // actually needs into .next/standalone.
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // npm workspaces hoist shared deps (e.g. @swc/helpers) to the monorepo
  // root's node_modules, not apps/web's own - without this, Next's output
  // file tracing (used by both `output: "standalone"` below and `vercel
  // build`) records traced files relative to apps/web only, missing
  // anything hoisted a level up. Surfaced as a real deploy failure
  // ("File does not exist: node_modules/@swc/helpers/..."), not by any
  // local dev or test run, since dev mode doesn't trace output at all.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Turbopack does its own separate workspace-root inference from
  // outputFileTracingRoot above (it doesn't read that option) - without
  // this it walks up from apps/web/app looking for the nearest
  // next/package.json, and apps/web/node_modules being a symlink to the
  // hoisted root node_modules (see the note in Dockerfile/package.json's
  // "prepare" fix) breaks that walk, erroring "couldn't find the Next.js
  // package" even though resolution works fine at runtime.
  turbopack: { root: path.join(__dirname, "../..") },
  // Minimizes the production Docker image (SAD §5: "Docker-deployable
  // backend" / no Vercel dependency) by tracing only the files each route
  // actually needs into .next/standalone. Conditional on NOT running on
  // Vercel (which always sets VERCEL=1 during its builds): Vercel has its
  // own serverless packaging pipeline that standalone mode actively
  // conflicts with - it never produces the per-route next-server.js.nft.json
  // file Vercel's own build step looks for afterward, since standalone
  // bundles everything into .next/standalone/ instead. Surfaced only by an
  // actual Vercel deploy, not by the Docker build or local dev/test - both
  // of those only ever exercised the non-Vercel branch.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  // Next.js 16.3 turns this on by default specifically on Vercel, and it
  // collides with Vercel's own Toolbar comment-patching step during
  // output deployment ("Cannot patch preview comments when immutable
  // static file upload is enabled") - confirmed by Vercel support, not
  // something guessable from the error text alone (which misleadingly
  // suggests a Next.js version bump, tried first and didn't help).
  supportsImmutableAssets: false,
  reactStrictMode: true,
  // Next 16 default-scaffolds AGENTS.md/CLAUDE.md into this directory on
  // every dev/build run. This repo already has a real, hand-maintained
  // CLAUDE.md at the root - a second auto-generated one here would be
  // confusing at best, so this is off rather than something to keep
  // re-deleting.
  agentRules: false,
};

export default nextConfig;

import { defineConfig } from "drizzle-kit";

// DL-SEC-004: prefer the privileged migration connection if set - `push`/
// `introspect` would need DDL rights DATABASE_URL (the restricted
// vexos_app runtime role) no longer has. `generate` (the only drizzle-kit
// command actually used day-to-day) diffs schema files against migration
// history and doesn't touch a live DB either way.
const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_MIGRATION_URL (or DATABASE_URL) must be set to run drizzle-kit (see .env.example).",
  );
}

export default defineConfig({
  // Points at the *compiled* schema, not src/schema/*.ts: drizzle-kit's own
  // module loader (unlike tsx, which runs the app/tests) doesn't resolve
  // the .js-suffixed relative imports our source uses for Node ESM
  // compatibility (see the schema files' "./enums.js" style imports) back
  // to their .ts source, and errors with MODULE_NOT_FOUND. Compiled output
  // has real .js files at those paths, so this just works - at the cost of
  // needing `tsc --build` run before `db:generate` picks up schema
  // changes. `db:migrate` (tsx, not drizzle-kit) is unaffected and always
  // reads current source directly.
  schema: "./dist/schema/*.js",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  strict: true,
  verbose: true,
});

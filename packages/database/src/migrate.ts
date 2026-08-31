// DL-SEC-004: migrations need a privileged connection (DDL rights, and
// CREATEROLE to provision nyxor_app - see
// migrations/0006_app_role_privilege_separation.sql) that's deliberately
// separate from DATABASE_URL, which now points at that restricted
// nyxor_app role for the application's own runtime connection. Using
// DATABASE_URL here would fail with permission errors once that
// separation is in place, by design - it's supposed to lack DDL rights.

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Resolved from this module's own location, not the process's cwd - "./src/
// migrations" previously only worked because `npm run db:migrate` (an npm
// workspace script) happens to run with cwd set to packages/database/. That
// assumption silently breaks the moment the compiled dist/migrate.js is
// invoked any other way - e.g. a Docker deploy's preDeployCommand running
// from the repo root - where it fails with "Can't find meta/_journal.json"
// since "./src/migrations" resolves against the wrong directory entirely.
// Caught only by an actual deploy attempt, not by any test.
const MIGRATIONS_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function main() {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_MIGRATION_URL must be set (see .env.example) - migrations run against a " +
        "privileged connection, separate from DATABASE_URL (which is the restricted nyxor_app " +
        "runtime role, DL-SEC-004).",
    );
  }

  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  console.warn("Running migrations...");
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.warn("Migrations complete.");

  // Idempotent - safe to re-run on every `db:migrate` invocation, and how
  // password rotation for nyxor_app would work going forward (change
  // DB_APP_ROLE_PASSWORD, re-run migrate, update DATABASE_URL to match).
  const appRolePassword = process.env.DB_APP_ROLE_PASSWORD;
  if (appRolePassword) {
    const escaped = appRolePassword.replace(/'/g, "''");
    await migrationClient.unsafe(`ALTER ROLE nyxor_app WITH PASSWORD '${escaped}'`);
    console.warn("Set nyxor_app application role password from DB_APP_ROLE_PASSWORD.");
  } else {
    console.warn(
      "DB_APP_ROLE_PASSWORD not set - skipping nyxor_app password setup. Fine if it's already " +
        "configured; a fresh database's nyxor_app role has no usable password until this is set.",
    );
  }

  await migrationClient.end();
}

main().catch((err: unknown) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

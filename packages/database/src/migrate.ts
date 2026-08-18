// DL-SEC-004: migrations need a privileged connection (DDL rights, and
// CREATEROLE to provision vexos_app - see
// migrations/0006_app_role_privilege_separation.sql) that's deliberately
// separate from DATABASE_URL, which now points at that restricted
// vexos_app role for the application's own runtime connection. Using
// DATABASE_URL here would fail with permission errors once that
// separation is in place, by design - it's supposed to lack DDL rights.

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_MIGRATION_URL must be set (see .env.example) - migrations run against a " +
        "privileged connection, separate from DATABASE_URL (which is the restricted vexos_app " +
        "runtime role, DL-SEC-004).",
    );
  }

  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  console.warn("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/migrations" });
  console.warn("Migrations complete.");

  // Idempotent - safe to re-run on every `db:migrate` invocation, and how
  // password rotation for vexos_app would work going forward (change
  // DB_APP_ROLE_PASSWORD, re-run migrate, update DATABASE_URL to match).
  const appRolePassword = process.env.DB_APP_ROLE_PASSWORD;
  if (appRolePassword) {
    const escaped = appRolePassword.replace(/'/g, "''");
    await migrationClient.unsafe(`ALTER ROLE vexos_app WITH PASSWORD '${escaped}'`);
    console.warn("Set vexos_app application role password from DB_APP_ROLE_PASSWORD.");
  } else {
    console.warn(
      "DB_APP_ROLE_PASSWORD not set - skipping vexos_app password setup. Fine if it's already " +
        "configured; a fresh database's vexos_app role has no usable password until this is set.",
    );
  }

  await migrationClient.end();
}

main().catch((err: unknown) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

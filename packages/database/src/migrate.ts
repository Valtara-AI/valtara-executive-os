import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set (see .env.example).");
  }

  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  console.warn("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/migrations" });
  console.warn("Migrations complete.");

  await migrationClient.end();
}

main().catch((err: unknown) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

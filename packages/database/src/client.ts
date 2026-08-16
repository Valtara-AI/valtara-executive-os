import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

let cachedClient: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (cachedClient) return cachedClient;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set (see .env.example).");
  }

  const queryClient = postgres(connectionString);
  cachedClient = drizzle(queryClient, { schema });
  return cachedClient;
}

export * as schema from "./schema/index";

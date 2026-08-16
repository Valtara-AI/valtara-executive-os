import { getDb, schema } from "./client.js";

async function main() {
  const db = getDb();

  const [executive] = await db
    .insert(schema.executives)
    .values({
      name: "Jordan Ellis",
      email: "jordan.ellis@example.com",
      organization: "Example Ventures",
      title: "CEO",
      domain: "Technology",
      onboardingStatus: "not_started",
    })
    .returning();

  console.warn("Seeded executive:", executive);
}

main().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

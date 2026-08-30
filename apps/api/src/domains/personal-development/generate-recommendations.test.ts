// Requires a live Postgres. Uses MockProvider so this is deterministic.

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { MockProvider } from "@nyxor/ai-orchestrator";
import { ExecutiveNotFoundError, generateRecommendations } from "./generate-recommendations.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

const VALID_RECOMMENDATIONS = JSON.stringify({
  recommendations: [
    {
      type: "book",
      title: "The Hard Thing About Hard Things",
      creator: "Ben Horowitz",
      rationale: "r1",
    },
    { type: "podcast", title: "Acquired", creator: null, rationale: "r2" },
    { type: "publication", title: "Stratechery", creator: "Ben Thompson", rationale: "r3" },
  ],
});

describe.skipIf(!hasDb)("generateRecommendations", () => {
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
  });

  async function makeExecutive() {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({
        name: "PersonalDev Test Exec",
        email: `pd-test-${Date.now()}-${Math.random()}@example.com`,
        title: "CEO",
        domain: "fintech",
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);
    return executive!;
  }

  it("generates and persists a batch of recommendations as 'suggested'", async () => {
    const executive = await makeExecutive();
    const provider = new MockProvider();
    provider.enqueue(VALID_RECOMMENDATIONS);

    const inserted = await generateRecommendations(executive.id, provider);

    expect(inserted).toHaveLength(3);
    expect(inserted.every((r) => r.status === "suggested")).toBe(true);
    expect(inserted.map((r) => r.title)).toContain("The Hard Thing About Hard Things");
    expect(provider.calls[0]?.systemPrompt).toContain("fintech");
  });

  it("retries once on malformed JSON, then succeeds", async () => {
    const executive = await makeExecutive();
    const provider = new MockProvider();
    provider.enqueue("not json at all", VALID_RECOMMENDATIONS);

    const inserted = await generateRecommendations(executive.id, provider);
    expect(inserted).toHaveLength(3);
  });

  it("excludes previously-recommended titles from the prompt", async () => {
    const db = getDb();
    const executive = await makeExecutive();
    await db.insert(schema.personalDevelopmentRecommendations).values({
      executiveId: executive.id,
      type: "book",
      title: "Zero to One",
      rationale: "prior",
    });

    const provider = new MockProvider();
    provider.enqueue(VALID_RECOMMENDATIONS);
    await generateRecommendations(executive.id, provider);

    expect(provider.calls[0]?.systemPrompt).toContain("Zero to One");
  });

  it("throws ExecutiveNotFoundError for a nonexistent executive", async () => {
    await expect(
      generateRecommendations("00000000-0000-0000-0000-000000000000", new MockProvider()),
    ).rejects.toThrow(ExecutiveNotFoundError);
  });
});

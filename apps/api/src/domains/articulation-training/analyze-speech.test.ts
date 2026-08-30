// Requires a live Postgres. Uses MockProvider so this is deterministic.

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { MockProvider } from "@nyxor/ai-orchestrator";
import { ExecutiveNotFoundError, analyzeSpeech } from "./analyze-speech.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

const VALID_FEEDBACK = JSON.stringify({
  clarityScore: 80,
  structureScore: 70,
  persuasivenessScore: 65,
  toneScore: 90,
  fillerPhrases: ["I think maybe"],
  strengths: ["Clear opening"],
  rewriteSuggestions: [
    { original: "I think maybe we should", suggested: "We should", reason: "r" },
  ],
  overallFeedback: "Solid overall, tighten the opening.",
});

describe.skipIf(!hasDb)("analyzeSpeech", () => {
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
        name: "Articulation Test Exec",
        email: `at-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);
    return executive!;
  }

  it("analyzes text input and persists flat score columns matching feedbackJson", async () => {
    const executive = await makeExecutive();
    const provider = new MockProvider();
    provider.enqueue(VALID_FEEDBACK);

    const session = await analyzeSpeech(executive.id, "pitch", "text", "Our pitch text.", provider);

    expect(session.inputMode).toBe("text");
    expect(session.clarityScore).toBe(80);
    expect(session.structureScore).toBe(70);
    expect(session.persuasivenessScore).toBe(65);
    expect(session.toneScore).toBe(90);
    // Catches copy-paste drift between the flat columns and the jsonb bag.
    const feedback = session.feedbackJson as { clarityScore: number };
    expect(session.clarityScore).toBe(feedback.clarityScore);
    expect(session.audioStoragePath).toBeNull();
  });

  it("retries once on malformed JSON, then succeeds", async () => {
    const executive = await makeExecutive();
    const provider = new MockProvider();
    provider.enqueue("not json at all", VALID_FEEDBACK);

    const session = await analyzeSpeech(executive.id, "speech", "text", "Speech text.", provider);
    expect(session.clarityScore).toBe(80);
  });

  it("persists audio metadata when given audio-mode options", async () => {
    const executive = await makeExecutive();
    const provider = new MockProvider();
    provider.enqueue(VALID_FEEDBACK);

    const session = await analyzeSpeech(
      executive.id,
      "presentation",
      "audio",
      "Transcribed text.",
      provider,
      { audioStoragePath: `${executive.id}/session-1.webm`, audioDurationSeconds: 42 },
    );

    expect(session.inputMode).toBe("audio");
    expect(session.audioStoragePath).toBe(`${executive.id}/session-1.webm`);
    expect(session.audioDurationSeconds).toBe(42);
  });

  it("throws ExecutiveNotFoundError for a nonexistent executive", async () => {
    await expect(
      analyzeSpeech(
        "00000000-0000-0000-0000-000000000000",
        "pitch",
        "text",
        "x",
        new MockProvider(),
      ),
    ).rejects.toThrow(ExecutiveNotFoundError);
  });
});

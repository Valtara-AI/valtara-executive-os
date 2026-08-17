// Requires a live Postgres. Uses MockProvider so this is deterministic.

import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { MockProvider } from "@vex-os/ai-orchestrator";
import { saveTokens } from "@vex-os/integrations";
import { ExecutiveNotFoundError, generateBrief, localDateString } from "./generate-brief.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

describe("localDateString", () => {
  it("formats as YYYY-MM-DD for a given timezone", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    expect(localDateString("UTC", date)).toBe("2026-03-15");
  });

  it("reflects a timezone offset that shifts the calendar date", () => {
    // 01:00 UTC on the 15th is still the 14th in US Pacific time.
    const date = new Date("2026-03-15T01:00:00Z");
    expect(localDateString("America/Los_Angeles", date)).toBe("2026-03-14");
  });
});

describe.skipIf(!hasDb)("generateBrief", () => {
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
        name: "Brief Test Exec",
        email: `brief-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);
    return executive!;
  }

  it("generates and persists a brief, including HITL and task context", async () => {
    const db = getDb();
    const executive = await makeExecutive();

    const [agent] = await db
      .insert(schema.agents)
      .values({
        executiveId: executive.id,
        name: "Inbox Agent",
        description: "d",
        responsibilities: ["r"],
      })
      .returning();
    const [task] = await db
      .insert(schema.tasks)
      .values({
        agentId: agent!.id,
        executiveId: executive.id,
        prompt: "Draft a reply.",
        status: "complete",
      })
      .returning();
    await db.insert(schema.taskOutputs).values({
      taskId: task!.id,
      modelProvider: "mock",
      modelId: "mock-model",
      promptVersion: "v1",
      outputText: "output",
      tokensInput: 1,
      tokensOutput: 1,
      durationMs: 1,
    });
    await db.insert(schema.hitlQueueItems).values({
      executiveId: executive.id,
      status: "pending",
      originalOutput: "A draft reply to the board.",
    });

    const provider = new MockProvider();
    provider.enqueue("Good morning. One item needs review, one task completed.");

    const brief = await generateBrief(executive.id, provider);

    expect(brief.content).toBe("Good morning. One item needs review, one task completed.");
    expect(brief.date).toBe(localDateString(executive.timezone));
    expect((brief.sectionsJson as { hitlQueueCount: number }).hitlQueueCount).toBe(1);
    expect((brief.sectionsJson as { taskActivityCount: number }).taskActivityCount).toBe(1);

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.systemPrompt).toContain("Inbox Agent");
    expect(provider.calls[0]?.systemPrompt).toContain("A draft reply to the board");
  });

  it("is idempotent: calling it twice in the same day returns the same brief, no second LLM call", async () => {
    const executive = await makeExecutive();
    const provider = new MockProvider();
    provider.enqueue("First brief.", "Second brief - should never be produced.");

    const first = await generateBrief(executive.id, provider);
    const second = await generateBrief(executive.id, provider);

    expect(second.id).toBe(first.id);
    expect(second.content).toBe("First brief.");
    expect(provider.calls).toHaveLength(1);
  });

  it("throws ExecutiveNotFoundError for a nonexistent executive", async () => {
    await expect(
      generateBrief("00000000-0000-0000-0000-000000000000", new MockProvider()),
    ).rejects.toThrow(ExecutiveNotFoundError);
  });

  it("includes real calendar and email context when Google is connected", async () => {
    const executive = await makeExecutive();
    await saveTokens(executive.id, "google", {
      accessToken: "at",
      refreshToken: "rt",
      scopes: [],
      expiresAt: new Date(Date.now() + 3600_000), // far future - no refresh call needed
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("calendar/v3")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                items: [
                  { id: "e1", summary: "Board sync", start: { dateTime: "2026-03-15T14:00:00Z" } },
                ],
              }),
          });
        }
        if (url.includes("gmail/v1")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                threads: [{ id: "t1", snippet: "Q3 numbers attached", historyId: "1" }],
              }),
          });
        }
        throw new Error(`Unexpected fetch to ${url}`);
      }),
    );

    const provider = new MockProvider();
    provider.enqueue("Brief with calendar and email.");

    try {
      const brief = await generateBrief(executive.id, provider);
      expect(brief.content).toBe("Brief with calendar and email.");
      expect((brief.sectionsJson as { googleConnected: boolean }).googleConnected).toBe(true);
      expect((brief.sectionsJson as { calendarEventCount: number }).calendarEventCount).toBe(1);
      expect((brief.sectionsJson as { unreadEmailCount: number }).unreadEmailCount).toBe(1);

      expect(provider.calls[0]?.systemPrompt).toContain("Board sync");
      expect(provider.calls[0]?.systemPrompt).toContain("Q3 numbers attached");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("includes real calendar and email context when Microsoft is connected", async () => {
    const executive = await makeExecutive();
    await saveTokens(executive.id, "microsoft", {
      accessToken: "at",
      refreshToken: "rt",
      scopes: [],
      expiresAt: new Date(Date.now() + 3600_000),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("calendarView")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                value: [
                  { id: "e1", subject: "Board sync", start: { dateTime: "2026-03-15T14:00:00Z" } },
                ],
              }),
          });
        }
        if (url.includes("/me/messages")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                value: [{ id: "m1", bodyPreview: "Q3 numbers attached", isRead: false }],
              }),
          });
        }
        throw new Error(`Unexpected fetch to ${url}`);
      }),
    );

    const provider = new MockProvider();
    provider.enqueue("Brief with calendar and email.");

    try {
      const brief = await generateBrief(executive.id, provider);
      expect(brief.content).toBe("Brief with calendar and email.");
      expect((brief.sectionsJson as { microsoftConnected: boolean }).microsoftConnected).toBe(true);
      expect((brief.sectionsJson as { calendarEventCount: number }).calendarEventCount).toBe(1);
      expect((brief.sectionsJson as { unreadEmailCount: number }).unreadEmailCount).toBe(1);

      expect(provider.calls[0]?.systemPrompt).toContain("Board sync");
      expect(provider.calls[0]?.systemPrompt).toContain("Q3 numbers attached");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("merges calendar/email from both providers when both Google and Microsoft are connected", async () => {
    const executive = await makeExecutive();
    await saveTokens(executive.id, "google", {
      accessToken: "at",
      refreshToken: "rt",
      scopes: [],
      expiresAt: new Date(Date.now() + 3600_000),
    });
    await saveTokens(executive.id, "microsoft", {
      accessToken: "at",
      refreshToken: "rt",
      scopes: [],
      expiresAt: new Date(Date.now() + 3600_000),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("calendar/v3")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                items: [
                  {
                    id: "g1",
                    summary: "Google event",
                    start: { dateTime: "2026-03-15T14:00:00Z" },
                  },
                ],
              }),
          });
        }
        if (url.includes("gmail/v1")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ threads: [{ id: "t1", snippet: "Gmail thread" }] }),
          });
        }
        if (url.includes("calendarView")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                value: [
                  {
                    id: "e1",
                    subject: "Outlook event",
                    start: { dateTime: "2026-03-15T16:00:00Z" },
                  },
                ],
              }),
          });
        }
        if (url.includes("/me/messages")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ value: [{ id: "m1", bodyPreview: "Outlook message" }] }),
          });
        }
        throw new Error(`Unexpected fetch to ${url}`);
      }),
    );

    const provider = new MockProvider();
    provider.enqueue("Brief with both providers.");

    try {
      const brief = await generateBrief(executive.id, provider);
      expect((brief.sectionsJson as { googleConnected: boolean }).googleConnected).toBe(true);
      expect((brief.sectionsJson as { microsoftConnected: boolean }).microsoftConnected).toBe(true);
      expect((brief.sectionsJson as { calendarEventCount: number }).calendarEventCount).toBe(2);
      expect((brief.sectionsJson as { unreadEmailCount: number }).unreadEmailCount).toBe(2);
      expect(provider.calls[0]?.systemPrompt).toContain("Google event");
      expect(provider.calls[0]?.systemPrompt).toContain("Outlook event");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("degrades gracefully (empty sections, brief still generates) when a Google API call fails", async () => {
    const executive = await makeExecutive();
    await saveTokens(executive.id, "google", {
      accessToken: "at",
      refreshToken: "rt",
      scopes: [],
      expiresAt: new Date(Date.now() + 3600_000),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: () => Promise.resolve(""),
      }),
    );

    const provider = new MockProvider();
    provider.enqueue("Brief without calendar/email due to fetch failure.");

    try {
      const brief = await generateBrief(executive.id, provider);
      expect(brief.content).toBe("Brief without calendar/email due to fetch failure.");
      expect((brief.sectionsJson as { googleConnected: boolean }).googleConnected).toBe(true);
      expect((brief.sectionsJson as { calendarEventCount: number }).calendarEventCount).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  }, 10000);
});

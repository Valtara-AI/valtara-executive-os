// Requires a live Postgres + DB_ENCRYPTION_KEY. Mirrors
// google/calendar-adapter.test.ts - same rationale as mail-adapter.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { saveTokens } from "../token-store.js";
import { OutlookCalendarAdapter } from "./calendar-adapter.js";
import { expectDbErrorMessage } from "../test-utils/expect-db-error-message.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

describe.skipIf(!hasDb)("OutlookCalendarAdapter", () => {
  const adapter = new OutlookCalendarAdapter();
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      const agentRows = await db
        .select({ id: schema.agents.id })
        .from(schema.agents)
        .where(eq(schema.agents.executiveId, id));
      for (const agent of agentRows) {
        await db.delete(schema.externalActions).where(eq(schema.externalActions.agentId, agent.id));
      }
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
    vi.restoreAllMocks();
  });

  async function makeConnectedExecutiveWithAgent() {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({
        name: "Outlook Cal Test Exec",
        email: `outlook-cal-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);
    await saveTokens(executive!.id, "microsoft", {
      accessToken: "at",
      refreshToken: "rt",
      scopes: [],
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const [agent] = await db
      .insert(schema.agents)
      .values({
        executiveId: executive!.id,
        name: "Cal Agent",
        description: "d",
        responsibilities: ["r"],
      })
      .returning();
    return { executive: executive!, agent: agent! };
  }

  it("listEvents parses the value array and sends the correct time range", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ value: [{ id: "e1", subject: "Standup" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const start = new Date("2026-03-15T00:00:00Z");
    const end = new Date("2026-03-16T00:00:00Z");
    const events = await adapter.listEvents(executive.id, start, end);

    expect(events).toEqual([{ id: "e1", subject: "Standup" }]);
    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("startDateTime")).toBe(start.toISOString());
    expect(calledUrl.searchParams.get("endDateTime")).toBe(end.toISOString());
  });

  it("createEvent rejects when the HITL item is only pending, and never calls Graph", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [pendingItem] = await db
      .insert(schema.hitlQueueItems)
      .values({
        executiveId: executive.id,
        status: "pending",
        originalOutput: "Schedule a meeting",
      })
      .returning();

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expectDbErrorMessage(
      adapter.createEvent(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: pendingItem!.id },
        { subject: "Meeting", start: "2026-03-15T10:00:00Z", end: "2026-03-15T10:30:00Z" },
      ),
      /not approved/i,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("createEvent succeeds once approved, and records the external_action", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [approvedItem] = await db
      .insert(schema.hitlQueueItems)
      .values({
        executiveId: executive.id,
        status: "approved",
        originalOutput: "Schedule a meeting",
        finalOutput: "Schedule a meeting",
        actionedAt: new Date(),
        actionedBy: executive.id,
      })
      .returning();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "event-1", subject: "Meeting" }),
      }),
    );

    const event = await adapter.createEvent(
      executive.id,
      { agentId: agent.id, hitlQueueItemId: approvedItem!.id },
      { subject: "Meeting", start: "2026-03-15T10:00:00Z", end: "2026-03-15T10:30:00Z" },
    );
    expect(event.id).toBe("event-1");

    const [action] = await db
      .select()
      .from(schema.externalActions)
      .where(eq(schema.externalActions.hitlQueueItemId, approvedItem!.id));
    expect(action?.actionType).toBe("create_calendar_event");
  });
});

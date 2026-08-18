// Requires a live Postgres + DB_ENCRYPTION_KEY. Mirrors
// calendar-adapter.test.ts - same rationale as mail-adapter.test.ts for
// why the HITL gate is tested against the real Postgres trigger rather
// than mocked.

import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { saveTokens } from "../token-store.js";
import { TeamsAdapter } from "./teams-adapter.js";
import { expectDbErrorMessage } from "../test-utils/expect-db-error-message.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

describe.skipIf(!hasDb)("TeamsAdapter", () => {
  const adapter = new TeamsAdapter();
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
        name: "Teams Test Exec",
        email: `teams-test-${Date.now()}-${Math.random()}@example.com`,
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
        name: "Teams Agent",
        description: "d",
        responsibilities: ["r"],
      })
      .returning();
    return { executive: executive!, agent: agent! };
  }

  it("listJoinedTeams parses the value array", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ value: [{ id: "t1", displayName: "Engineering" }] }),
      }),
    );

    expect(await adapter.listJoinedTeams(executive.id)).toEqual([
      { id: "t1", displayName: "Engineering" },
    ]);
  });

  it("listChannels parses the value array", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ value: [{ id: "c1", displayName: "General" }] }),
      }),
    );

    expect(await adapter.listChannels(executive.id, "t1")).toEqual([
      { id: "c1", displayName: "General" },
    ]);
  });

  it("listChannelMessages returns an empty array when Graph returns no value field", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );
    expect(await adapter.listChannelMessages(executive.id, "t1", "c1")).toEqual([]);
  });

  it("listChats parses the value array", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ value: [{ id: "ch1", topic: "Board prep" }] }),
      }),
    );

    expect(await adapter.listChats(executive.id)).toEqual([{ id: "ch1", topic: "Board prep" }]);
  });

  it("listChatMessages returns an empty array when Graph returns no value field", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );
    expect(await adapter.listChatMessages(executive.id, "ch1")).toEqual([]);
  });

  it("sendChannelMessage rejects (and never calls Graph) when the HITL item is only pending", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [pendingItem] = await db
      .insert(schema.hitlQueueItems)
      .values({ executiveId: executive.id, status: "pending", originalOutput: "Post update" })
      .returning();

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expectDbErrorMessage(
      adapter.sendChannelMessage(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: pendingItem!.id },
        "t1",
        "c1",
        "Status update",
      ),
      /not approved/i,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sendChannelMessage succeeds once the HITL item is approved, and records the external_action", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [approvedItem] = await db
      .insert(schema.hitlQueueItems)
      .values({
        executiveId: executive.id,
        status: "approved",
        originalOutput: "Post update",
        finalOutput: "Post update",
        actionedAt: new Date(),
        actionedBy: executive.id,
      })
      .returning();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "m1" }) }),
    );

    const result = await adapter.sendChannelMessage(
      executive.id,
      { agentId: agent.id, hitlQueueItemId: approvedItem!.id },
      "t1",
      "c1",
      "Status update",
    );
    expect(result.id).toBe("m1");

    const [action] = await db
      .select()
      .from(schema.externalActions)
      .where(eq(schema.externalActions.hitlQueueItemId, approvedItem!.id));
    expect(action?.actionType).toBe("post_teams_channel_message");
  });

  it("sendChatMessage rejects (and never calls Graph) when the HITL item is only pending", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [pendingItem] = await db
      .insert(schema.hitlQueueItems)
      .values({ executiveId: executive.id, status: "pending", originalOutput: "Chat update" })
      .returning();

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expectDbErrorMessage(
      adapter.sendChatMessage(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: pendingItem!.id },
        "ch1",
        "Status update",
      ),
      /not approved/i,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sendChatMessage succeeds once the HITL item is approved, and records the external_action", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [approvedItem] = await db
      .insert(schema.hitlQueueItems)
      .values({
        executiveId: executive.id,
        status: "approved",
        originalOutput: "Chat update",
        finalOutput: "Chat update",
        actionedAt: new Date(),
        actionedBy: executive.id,
      })
      .returning();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "m2" }) }),
    );

    const result = await adapter.sendChatMessage(
      executive.id,
      { agentId: agent.id, hitlQueueItemId: approvedItem!.id },
      "ch1",
      "Status update",
    );
    expect(result.id).toBe("m2");

    const [action] = await db
      .select()
      .from(schema.externalActions)
      .where(eq(schema.externalActions.hitlQueueItemId, approvedItem!.id));
    expect(action?.actionType).toBe("post_teams_chat_message");
  });

  it("sendChannelMessage rejects a nonexistent HITL item", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal("fetch", vi.fn());

    await expectDbErrorMessage(
      adapter.sendChannelMessage(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: "00000000-0000-0000-0000-000000000000" },
        "t1",
        "c1",
        "Status update",
      ),
      /does not reference/i,
    );
  });
});

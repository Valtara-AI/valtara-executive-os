// Requires a live Postgres + DB_ENCRYPTION_KEY. Mirrors
// gmail-adapter.test.ts's HITL-gate-against-the-real-trigger pattern - see
// that file's header for the full rationale.

import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { saveTokens } from "../token-store.js";
import { SlackAdapter } from "./slack-adapter.js";
import { expectDbErrorMessage } from "../test-utils/expect-db-error-message.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

describe.skipIf(!hasDb)("SlackAdapter", () => {
  const adapter = new SlackAdapter();
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
        name: "Slack Test Exec",
        email: `slack-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);
    await saveTokens(executive!.id, "slack", {
      accessToken: "xoxb-at",
      scopes: [],
      expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
    });
    const [agent] = await db
      .insert(schema.agents)
      .values({
        executiveId: executive!.id,
        name: "Slack Agent",
        description: "d",
        responsibilities: ["r"],
      })
      .returning();
    return { executive: executive!, agent: agent! };
  }

  it("listChannels parses the channels array", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, channels: [{ id: "C1", name: "general" }] }),
      }),
    );

    const channels = await adapter.listChannels(executive.id);
    expect(channels).toEqual([{ id: "C1", name: "general" }]);
  });

  it("listChannels returns an empty array when Slack returns no channels field", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }),
    );
    expect(await adapter.listChannels(executive.id)).toEqual([]);
  });

  it("postMessage rejects (and never calls Slack) when the HITL item is only pending", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [pendingItem] = await db
      .insert(schema.hitlQueueItems)
      .values({ executiveId: executive.id, status: "pending", originalOutput: "Post update" })
      .returning();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, ts: "1", channel: "C1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expectDbErrorMessage(
      adapter.postMessage(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: pendingItem!.id },
        "C1",
        "Status update",
      ),
      /not approved/i,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("postMessage succeeds once the HITL item is approved, and records the external_action", async () => {
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
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, ts: "1699999999.000100", channel: "C1" }),
      }),
    );

    const result = await adapter.postMessage(
      executive.id,
      { agentId: agent.id, hitlQueueItemId: approvedItem!.id },
      "C1",
      "Status update",
    );
    expect(result.ts).toBe("1699999999.000100");

    const [action] = await db
      .select()
      .from(schema.externalActions)
      .where(eq(schema.externalActions.hitlQueueItemId, approvedItem!.id));
    expect(action?.actionType).toBe("post_slack_message");
  });

  it("postMessage rejects a nonexistent HITL item", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal("fetch", vi.fn());

    await expectDbErrorMessage(
      adapter.postMessage(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: "00000000-0000-0000-0000-000000000000" },
        "C1",
        "Status update",
      ),
      /does not reference/i,
    );
  });
});

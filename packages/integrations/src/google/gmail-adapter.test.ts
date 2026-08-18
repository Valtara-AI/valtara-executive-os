// Requires a live Postgres + DB_ENCRYPTION_KEY. Mocks the global fetch for
// both the Google API and (where relevant) the token endpoint, so this is
// deterministic without real Google credentials. sendMessage's HITL gate
// uses the *real* Postgres trigger (0001_hitl_enforcement.sql) - the same
// mechanism proven generically in
// packages/database/src/__tests__/external-action-trigger.test.ts, here
// exercised through the actual adapter method a task-execution pipeline
// would call.

import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { saveTokens } from "../token-store.js";
import { GoogleMailAdapter } from "./gmail-adapter.js";
import { expectDbErrorMessage } from "../test-utils/expect-db-error-message.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

describe.skipIf(!hasDb)("GoogleMailAdapter", () => {
  const adapter = new GoogleMailAdapter();
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      // external_actions.agent_id is ON DELETE RESTRICT, not CASCADE
      // (deliberately - see external-action.ts), so any row this suite's
      // sendMessage tests created must go before the executive/agent it
      // references (same pattern as
      // packages/database/src/__tests__/external-action-trigger.test.ts).
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
        name: "Gmail Test Exec",
        email: `gmail-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);
    await saveTokens(executive!.id, "google", {
      accessToken: "at",
      refreshToken: "rt",
      scopes: [],
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const [agent] = await db
      .insert(schema.agents)
      .values({
        executiveId: executive!.id,
        name: "Mail Agent",
        description: "d",
        responsibilities: ["r"],
      })
      .returning();
    return { executive: executive!, agent: agent! };
  }

  it("listThreads parses the threads array", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ threads: [{ id: "t1", snippet: "hi", historyId: "1" }] }),
      }),
    );

    const threads = await adapter.listThreads(executive.id, "is:unread", 5);
    expect(threads).toEqual([{ id: "t1", snippet: "hi", historyId: "1" }]);
  });

  it("listThreads returns an empty array when Gmail returns no threads field", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );
    expect(await adapter.listThreads(executive.id, "is:unread")).toEqual([]);
  });

  it("createDraft is unrestricted - no HITL item required", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "draft-1" }) }),
    );
    const draft = await adapter.createDraft(executive.id, "base64-rfc2822-content");
    expect(draft.id).toBe("draft-1");
  });

  it("sendMessage rejects (and never calls the Gmail API) when the HITL item is only pending", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [pendingItem] = await db
      .insert(schema.hitlQueueItems)
      .values({ executiveId: executive.id, status: "pending", originalOutput: "Draft email" })
      .returning();

    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "sent-1" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expectDbErrorMessage(
      adapter.sendMessage(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: pendingItem!.id },
        "raw-content",
      ),
      /not approved/i,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sendMessage succeeds once the HITL item is approved, and records the external_action", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [approvedItem] = await db
      .insert(schema.hitlQueueItems)
      .values({
        executiveId: executive.id,
        status: "approved",
        originalOutput: "Draft email",
        finalOutput: "Draft email",
        actionedAt: new Date(),
        actionedBy: executive.id,
      })
      .returning();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "sent-1" }) }),
    );

    const result = await adapter.sendMessage(
      executive.id,
      { agentId: agent.id, hitlQueueItemId: approvedItem!.id },
      "raw-content",
    );
    expect(result.id).toBe("sent-1");

    const [action] = await db
      .select()
      .from(schema.externalActions)
      .where(eq(schema.externalActions.hitlQueueItemId, approvedItem!.id));
    expect(action?.actionType).toBe("send_email");
  });

  it("sendMessage rejects a nonexistent HITL item", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal("fetch", vi.fn());

    await expectDbErrorMessage(
      adapter.sendMessage(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: "00000000-0000-0000-0000-000000000000" },
        "raw-content",
      ),
      /does not reference/i,
    );
  });
});

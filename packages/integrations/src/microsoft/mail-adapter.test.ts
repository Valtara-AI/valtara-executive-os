// Requires a live Postgres + DB_ENCRYPTION_KEY. Mirrors gmail-adapter.test.ts
// - see that file's header for why the HITL gate is tested against the
// real Postgres trigger rather than mocked.

import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { saveTokens } from "../token-store.js";
import { OutlookMailAdapter } from "./mail-adapter.js";
import { expectDbErrorMessage } from "../test-utils/expect-db-error-message.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

describe.skipIf(!hasDb)("OutlookMailAdapter", () => {
  const adapter = new OutlookMailAdapter();
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
        name: "Outlook Mail Test Exec",
        email: `outlook-mail-test-${Date.now()}-${Math.random()}@example.com`,
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
        name: "Mail Agent",
        description: "d",
        responsibilities: ["r"],
      })
      .returning();
    return { executive: executive!, agent: agent! };
  }

  it("listMessages parses the value array", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ value: [{ id: "m1", subject: "Hi", isRead: false }] }),
      }),
    );

    const messages = await adapter.listMessages(executive.id, "board deck", 5);
    expect(messages).toEqual([{ id: "m1", subject: "Hi", isRead: false }]);
  });

  it("listMessages returns an empty array when Graph returns no value field", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );
    expect(await adapter.listMessages(executive.id, "board deck")).toEqual([]);
  });

  it("listUnreadMessages filters on isRead eq false, not $search", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ value: [{ id: "m1", isRead: false }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const messages = await adapter.listUnreadMessages(executive.id, 5);
    expect(messages).toEqual([{ id: "m1", isRead: false }]);
    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("$filter")).toBe("isRead eq false");
  });

  it("createDraft is unrestricted - no HITL item required", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "draft-1" }) }),
    );
    const draft = await adapter.createDraft(executive.id, {
      subject: "Subject",
      body: "Body",
      toRecipients: [{ address: "a@example.com" }],
    });
    expect(draft.id).toBe("draft-1");
  });

  it("sendMail rejects (and never calls Graph) when the HITL item is only pending", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [pendingItem] = await db
      .insert(schema.hitlQueueItems)
      .values({ executiveId: executive.id, status: "pending", originalOutput: "Draft email" })
      .returning();

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);

    await expectDbErrorMessage(
      adapter.sendMail(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: pendingItem!.id },
        { subject: "S", body: "B", toRecipients: [{ address: "a@example.com" }] },
      ),
      /not approved/i,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sendMail succeeds once the HITL item is approved, and records the external_action", async () => {
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
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );

    await adapter.sendMail(
      executive.id,
      { agentId: agent.id, hitlQueueItemId: approvedItem!.id },
      { subject: "S", body: "B", toRecipients: [{ address: "a@example.com" }] },
    );

    const [action] = await db
      .select()
      .from(schema.externalActions)
      .where(eq(schema.externalActions.hitlQueueItemId, approvedItem!.id));
    expect(action?.actionType).toBe("send_email");
  });

  it("sendMail rejects a nonexistent HITL item", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal("fetch", vi.fn());

    await expectDbErrorMessage(
      adapter.sendMail(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: "00000000-0000-0000-0000-000000000000" },
        { subject: "S", body: "B", toRecipients: [{ address: "a@example.com" }] },
      ),
      /does not reference/i,
    );
  });
});

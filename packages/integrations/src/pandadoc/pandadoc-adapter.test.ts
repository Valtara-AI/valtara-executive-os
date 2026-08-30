// Requires a live Postgres + DB_ENCRYPTION_KEY. Mirrors
// teams-adapter.test.ts - same rationale as mail-adapter.test.ts for why
// the HITL gate is tested against the real Postgres trigger rather than
// mocked.

import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import { saveTokens } from "../token-store.js";
import { PandaDocAdapter } from "./pandadoc-adapter.js";
import { expectDbErrorMessage } from "../test-utils/expect-db-error-message.js";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.DB_ENCRYPTION_KEY);

describe.skipIf(!hasDb)("PandaDocAdapter", () => {
  const adapter = new PandaDocAdapter();
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
        name: "PandaDoc Test Exec",
        email: `pandadoc-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);
    await saveTokens(executive!.id, "pandadoc", {
      accessToken: "at",
      refreshToken: "rt",
      scopes: [],
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const [agent] = await db
      .insert(schema.agents)
      .values({
        executiveId: executive!.id,
        name: "PandaDoc Agent",
        description: "d",
        responsibilities: ["r"],
      })
      .returning();
    return { executive: executive!, agent: agent! };
  }

  it("listDocuments parses the results array", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ id: "d1", name: "Series B Deck", status: "document.draft" }],
          }),
      }),
    );

    expect(await adapter.listDocuments(executive.id)).toEqual([
      { id: "d1", name: "Series B Deck", status: "document.draft" },
    ]);
  });

  it("listDocuments returns an empty array when PandaDoc returns no results field", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );
    expect(await adapter.listDocuments(executive.id)).toEqual([]);
  });

  it("getDocumentStatus returns the parsed document", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ id: "d1", name: "Series B Deck", status: "document.uploaded" }),
      }),
    );

    expect(await adapter.getDocumentStatus(executive.id, "d1")).toEqual({
      id: "d1",
      name: "Series B Deck",
      status: "document.uploaded",
    });
  });

  it("createDocumentFromTemplate never requires a HITL context (unrestricted)", async () => {
    const { executive } = await makeConnectedExecutiveWithAgent();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "d1", name: "Series B Deck", status: "document.uploaded" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await adapter.createDocumentFromTemplate(executive.id, {
      name: "Series B Deck",
      templateUuid: "tpl-1",
      recipients: [{ email: "board@example.com" }],
    });
    expect(result.status).toBe("document.uploaded");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.pandadoc.com/public/v1/documents",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sendDocument rejects (and never calls PandaDoc) when the HITL item is only pending", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [pendingItem] = await db
      .insert(schema.hitlQueueItems)
      .values({
        executiveId: executive.id,
        status: "pending",
        originalOutput: "Send Series B deck",
      })
      .returning();

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expectDbErrorMessage(
      adapter.sendDocument(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: pendingItem!.id },
        "d1",
      ),
      /not approved/i,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sendDocument succeeds once the HITL item is approved, and records the external_action", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    const db = getDb();
    const [approvedItem] = await db
      .insert(schema.hitlQueueItems)
      .values({
        executiveId: executive.id,
        status: "approved",
        originalOutput: "Send Series B deck",
        finalOutput: "Send Series B deck",
        actionedAt: new Date(),
        actionedBy: executive.id,
      })
      .returning();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "d1", name: "Series B Deck", status: "document.sent" }),
      }),
    );

    const result = await adapter.sendDocument(
      executive.id,
      { agentId: agent.id, hitlQueueItemId: approvedItem!.id },
      "d1",
    );
    expect(result.status).toBe("document.sent");

    const [action] = await db
      .select()
      .from(schema.externalActions)
      .where(eq(schema.externalActions.hitlQueueItemId, approvedItem!.id));
    expect(action?.actionType).toBe("send_pandadoc_document");
  });

  it("sendDocument rejects a nonexistent HITL item", async () => {
    const { executive, agent } = await makeConnectedExecutiveWithAgent();
    vi.stubGlobal("fetch", vi.fn());

    await expectDbErrorMessage(
      adapter.sendDocument(
        executive.id,
        { agentId: agent.id, hitlQueueItemId: "00000000-0000-0000-0000-000000000000" },
        "d1",
      ),
      /does not reference/i,
    );
  });
});
